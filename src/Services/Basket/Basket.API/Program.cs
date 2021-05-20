using System.Net;
using Basket.API.Infrastructure.Middlewares;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.eShopOnContainers.Services.Basket.API;
using Microsoft.Extensions.Hosting;

CreateHostBuilder(args).Build().Run();

IHostBuilder CreateHostBuilder(string[] args) =>
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(webBuilder =>
        {
            webBuilder
                .ConfigureKestrel(options =>
                {
                    options.Listen(IPAddress.Any, 80, listenOptions =>
                    {
                        listenOptions.Protocols = HttpProtocols.Http1AndHttp2;
                    });

                    options.Listen(IPAddress.Any, 81, listenOptions =>
                    {
                        listenOptions.Protocols = HttpProtocols.Http2;
                    });

                })
                .UseFailing(options =>
                {
                    options.ConfigPath = "/Failing";
                    options.NotFilteredPaths.AddRange(new[] { "/hc", "/liveness" });
                })
                .UseStartup<Startup>();
        });
