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
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0.0";
        var loader = ReadLoaderResource();
        var payload = LoaderPayload.Build(loader, version);

        if (_injector.RegisterScript(payload))
        {
            _logger.LogInformation("X-Ray loader registered with the JavaScript Injector.");
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        _injector.UnregisterAll(LoaderPayload.PluginId);
        return Task.CompletedTask;
    }

    private static string ReadLoaderResource()
    {
        using var stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream("Jellyfin.Plugin.Xray.Web.loader.js")
            ?? throw new InvalidOperationException("Embedded loader.js resource missing.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
