using System.Reflection;
using System.Runtime.Loader;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.Xray.Services;

/// <summary>Talks to the JavaScript Injector plugin via reflection, with no compile-time dependency.</summary>
public sealed class InjectorClient
{
    private const string InterfaceTypeName = "Jellyfin.Plugin.JavaScriptInjector.PluginInterface";
    private readonly ILogger<InjectorClient> _logger;
    private readonly Func<Type?> _resolveInterface;

    /// <summary>Initializes a new instance of the <see cref="InjectorClient"/> class.</summary>
    public InjectorClient(ILogger<InjectorClient> logger)
        : this(logger, DefaultResolve)
    {
    }

    /// <summary>Initializes a new instance with a custom interface resolver (used by tests).</summary>
    public InjectorClient(ILogger<InjectorClient> logger, Func<Type?> resolveInterface)
    {
        _logger = logger;
        _resolveInterface = resolveInterface;
    }

    /// <summary>Gets a value indicating whether the injector plugin is loaded.</summary>
    /// <remarks>
    /// This property scans all loaded assemblies on every access. Callers should not poll it in a tight loop;
    /// cache the result if availability needs to be checked repeatedly.
    /// </remarks>
    public bool IsAvailable => _resolveInterface() is not null;

    /// <summary>Registers a script payload with the injector. Returns false if the injector is absent.</summary>
    public bool RegisterScript(JObject payload) =>
        Invoke("RegisterScript", [payload]) is true;

    /// <summary>Removes all scripts previously registered by the given plugin id.</summary>
    /// <remarks>
    /// Returns false only when the injector is absent or the reflected method throws; it does not indicate
    /// how many scripts were removed (the injector may remove zero or more scripts and still return true).
    /// </remarks>
    public bool UnregisterAll(string pluginId) =>
        Invoke("UnregisterAllScriptsFromPlugin", [pluginId]) is not null;

    private object? Invoke(string method, object[] args)
    {
        var type = _resolveInterface();
        if (type is null)
        {
            _logger.LogWarning(
                "JavaScript Injector plugin not found; X-Ray cannot inject its script. Install it to enable X-Ray.");
            return null;
        }

        var info = type.GetMethod(method, BindingFlags.Public | BindingFlags.Static);
        if (info is null)
        {
            _logger.LogError("JavaScript Injector method {Method} not found; injector version too old.", method);
            return null;
        }

        try
        {
            return info.Invoke(null, args);
        }
        catch (TargetInvocationException ex)
        {
            _logger.LogError(ex.InnerException, "JavaScript Injector {Method} threw.", method);
            return null;
        }
    }

    private static Type? DefaultResolve() =>
        AssemblyLoadContext.All
            .SelectMany(context => context.Assemblies)
            .FirstOrDefault(a => a.FullName?.Contains("Jellyfin.Plugin.JavaScriptInjector", StringComparison.Ordinal) ?? false)
            ?.GetType(InterfaceTypeName);
}
