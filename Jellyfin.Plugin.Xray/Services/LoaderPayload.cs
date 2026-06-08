using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.Xray.Services;

/// <summary>Builds the JObject payload accepted by the JavaScript Injector's RegisterScript.</summary>
public static class LoaderPayload
{
    /// <summary>The stable script id; reused so registration is idempotent.</summary>
    public const string ScriptId = "xray-loader";

    /// <summary>The X-Ray plugin GUID as a string.</summary>
    public const string PluginId = "b4e9c1a2-7d3f-4e8a-9c1b-2f6a5d8e3c7b";

    /// <summary>Builds the registration payload for the given loader script body and plugin version.</summary>
    public static JObject Build(string script, string pluginVersion) => new()
    {
        ["id"] = ScriptId,
        ["name"] = "X-Ray",
        ["script"] = script,
        ["enabled"] = true,
        ["requiresAuthentication"] = true,
        ["pluginId"] = PluginId,
        ["pluginName"] = "X-Ray",
        ["pluginVersion"] = pluginVersion
    };
}
