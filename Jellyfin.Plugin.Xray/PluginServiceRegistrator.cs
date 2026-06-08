using Jellyfin.Plugin.Xray.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.Xray;

/// <summary>Registers X-Ray services into the Jellyfin DI container.</summary>
public sealed class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton<InjectorClient>();
        serviceCollection.AddHostedService<XrayRegistrationService>();
    }
}
