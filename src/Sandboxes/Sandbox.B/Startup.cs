using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Sandbox.B
{
    public class Startup
    {
        public void ConfigureServices(IServiceCollection services)
        {
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            app.UseRouting();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapGet("/", async context =>
                {
                    var sourceIP_Connection = context.Connection.RemoteIpAddress;
                    var sourceIP_Header = context.Request.Headers["X-Forwarded-For"];
                    var res = @$"
sourceIP_Connection: ${sourceIP_Connection}
sourceIP_Header: ${sourceIP_Header}
                    ";
                    await context.Response.WriteAsync(res);
                });
            });
        }
    }
}
