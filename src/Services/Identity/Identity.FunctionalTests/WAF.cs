using System.Threading.Tasks;
using IdentityServer4.EntityFramework.DbContexts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.eShopOnContainers.Services.Identity.API;
using Microsoft.eShopOnContainers.Services.Identity.API.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Identity.FunctionalTests
{
    public class TestStartup : Startup
    {
        public TestStartup(IConfiguration configuration) : base(configuration)
        { }

        public override void ConfigureDbContext(DbContextOptionsBuilder builder)
        {
            builder.UseInMemoryDatabase("InMemory");
        }

    }
    public class WAF : WebApplicationFactory<Startup>
    {
        public async Task SeedIdentityServer()
        {
            using var scope = this.Services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ConfigurationDbContext>();
            await new ConfigurationDbContextSeed()
                .SeedAsync(context, scope.ServiceProvider.GetRequiredService<IConfiguration>());
        }

        protected override IHostBuilder CreateHostBuilder()
        {
            var builder = Host.CreateDefaultBuilder()
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder
                        .UseStartup<TestStartup>();
                });
            return builder;
        }
    }
}
