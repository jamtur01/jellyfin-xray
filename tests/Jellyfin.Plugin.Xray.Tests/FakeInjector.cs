using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.Xray.Tests;

/// <summary>Mimics the JavaScript Injector's public static PluginInterface for reflection tests.</summary>
public static class FakeInjectorPluginInterface
{
    public static JObject? LastRegistered { get; set; }
    public static string? LastUnregisteredPluginId { get; set; }

    public static bool RegisterScript(JObject payload)
    {
        LastRegistered = payload;
        return true;
    }

    public static int UnregisterAllScriptsFromPlugin(string pluginId)
    {
        LastUnregisteredPluginId = pluginId;
        return 1;
    }
}
