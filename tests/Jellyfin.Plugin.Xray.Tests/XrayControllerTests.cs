using Jellyfin.Plugin.Xray.Configuration;
using Jellyfin.Plugin.Xray.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Jellyfin.Plugin.Xray.Tests;

public class XrayControllerTests
{
    private static XrayController NewController() =>
        new()
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

    [Fact]
    public void GetScript_ReturnsJavaScriptContentType()
    {
        var controller = NewController();
        var result = controller.GetScript();

        var file = Assert.IsType<FileStreamResult>(result);
        Assert.Equal("application/javascript", file.ContentType);
        Assert.Equal("public, max-age=86400", controller.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public void GetConfig_ReturnsConfigValues()
    {
        var config = new PluginConfiguration { IncludeGuestStars = false, MaxCast = 7, ButtonIcon = "groups" };

        var result = XrayController.BuildConfigDto(config);

        Assert.False(result.IncludeGuestStars);
        Assert.Equal(7, result.MaxCast);
        Assert.Equal("groups", result.ButtonIcon);
    }

    [Fact]
    public void GetConfig_ReturnsDefaults_WhenNoPluginInstance()
    {
        // Plugin.Instance is null in the test harness (no DI host), so GetConfig falls back to new PluginConfiguration().
        var result = NewController().GetConfig();
        var ok = Assert.IsType<ActionResult<XrayController.ConfigDto>>(result);
        var dto = ok.Value!;
        // Assert the three DTO fields are present and non-null (exact defaults only valid when Plugin.Instance is null).
        Assert.NotNull(dto);
        Assert.True(dto.IncludeGuestStars);
        Assert.Equal(50, dto.MaxCast);
        Assert.Equal("people", dto.ButtonIcon);
    }
}
