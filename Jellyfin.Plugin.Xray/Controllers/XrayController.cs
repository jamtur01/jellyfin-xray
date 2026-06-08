using System.Reflection;
using Jellyfin.Plugin.Xray.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Xray.Controllers;

/// <summary>Serves the X-Ray client bundle and its runtime configuration.</summary>
[ApiController]
[Route("XRay")]
public class XrayController : ControllerBase
{
    /// <summary>The client-facing subset of plugin configuration.</summary>
    public sealed record ConfigDto(bool IncludeGuestStars, int MaxCast, string ButtonIcon);

    /// <summary>Serves the bundled client JavaScript.</summary>
    [HttpGet("script")]
    [AllowAnonymous]
    [Produces("application/javascript")]
    public ActionResult GetScript()
    {
        var stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream("Jellyfin.Plugin.Xray.Web.dist.xray.js");
        if (stream is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public, max-age=86400";
        return File(stream, "application/javascript");
    }

    /// <summary>Serves the client configuration as JSON.</summary>
    [HttpGet("config")]
    [AllowAnonymous]
    public ActionResult<ConfigDto> GetConfig() =>
        BuildConfigDto(Plugin.Instance?.Configuration ?? new PluginConfiguration());

    /// <summary>Maps plugin configuration to the client DTO (extracted for testing).</summary>
    public static ConfigDto BuildConfigDto(PluginConfiguration config) =>
        new(config.IncludeGuestStars, config.MaxCast, config.ButtonIcon);
}
