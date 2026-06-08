using System.IO;
using System.Reflection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Xray.Services;

/// <summary>Registers the X-Ray loader with the JavaScript Injector on startup and removes it on shutdown.</summary>
public sealed class XrayRegistrationService : IHostedService
{
    private readonly InjectorClient _injector;
    private readonly ILogger<XrayRegistrationService> _logger;

    /// <summary>Initializes a new instance of the <see cref="XrayRegistrationService"/> class.</summary>
    public XrayRegistrationService(InjectorClient injector, ILogger<XrayRegistrationService> logger)
    {
        _injector = injector;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var version = assembly.GetName().Version?.ToString() ?? "1.0.0.0";

        string loader;
        try { loader = ReadLoaderResource(assembly); }
        catch (InvalidOperationException ex)
        {
            _logger.LogError(ex, "X-Ray startup failed: embedded loader.js is missing.");
            throw;
        }

        var payload = LoaderPayload.Build(loader, version);

        if (_injector.RegisterScript(payload))
        {
            _logger.LogInformation("X-Ray loader registered with the JavaScript Injector.");
        }
        else
        {
            _logger.LogWarning("X-Ray loader not registered; the JavaScript Injector plugin is absent.");
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        _injector.UnregisterAll(LoaderPayload.PluginId);
        return Task.CompletedTask;
    }

    private static string ReadLoaderResource(Assembly assembly)
    {
        using var stream = assembly
            .GetManifestResourceStream("Jellyfin.Plugin.Xray.Web.loader.js")
            ?? throw new InvalidOperationException("Embedded loader.js resource missing.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
