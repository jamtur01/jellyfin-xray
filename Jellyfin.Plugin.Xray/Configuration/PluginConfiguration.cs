using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.Xray.Configuration;

/// <summary>Settings for the X-Ray plugin.</summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>Gets or sets a value indicating whether guest stars are shown alongside actors.</summary>
    public bool IncludeGuestStars { get; set; } = true;

    /// <summary>Gets or sets the maximum number of cast members shown in the panel.</summary>
    public int MaxCast { get; set; } = 50;

    /// <summary>Gets or sets the Material Icons glyph name used for the player button.</summary>
    public string ButtonIcon { get; set; } = "people";
}
