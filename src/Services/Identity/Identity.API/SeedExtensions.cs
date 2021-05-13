using IdentityServer4.EntityFramework.DbContexts;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.eShopOnContainers.Services.Identity.API;
using Microsoft.eShopOnContainers.Services.Identity.API.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;

namespace Microsoft.AspNetCore.Hosting
{
    public static class IWebHostExtensions
    {
        public static IHost Seed(this IHost host)
        {
            return host.MigrateDbContext<PersistedGrantDbContext>((_, __) => { })
            // return host
                .MigrateDbContext<ApplicationDbContext>((context, services) =>
                {
                    var env = services.GetRequiredService<IWebHostEnvironment>();
                    var logger = services.GetRequiredService<ILogger<ApplicationDbContextSeed>>();
                    var settings = services.GetRequiredService<IOptions<AppSettings>>();

                    new ApplicationDbContextSeed()
                        .SeedAsync(context, env, logger, settings)
                        .Wait();
                })
                .MigrateDbContext<ConfigurationDbContext>((context, services) =>
                {
                    new ConfigurationDbContextSeed()
                        .SeedAsync(context, services.GetRequiredService<IConfiguration>())
                        .Wait();
                });
        }

        public static void Seed(this IApplicationBuilder app)
        {
            // return host.MigrateDbContext<PersistedGrantDbContext>((_, __) => { })
            app
                .MigrateDbContext<ApplicationDbContext>((context, services) =>
                {
                    var env = services.GetRequiredService<IWebHostEnvironment>();
                    var logger = services.GetRequiredService<ILogger<ApplicationDbContextSeed>>();
                    var settings = services.GetRequiredService<IOptions<AppSettings>>();

                    new ApplicationDbContextSeed()
                        .SeedAsync(context, env, logger, settings)
                        .Wait();
                })
                .MigrateDbContext<ConfigurationDbContext>((context, services) =>
                {
                    new ConfigurationDbContextSeed()
                        .SeedAsync(context, services.GetRequiredService<IConfiguration>())
                        .Wait();
                });
            var lifetime = app.ApplicationServices.GetRequiredService<IHostApplicationLifetime>();
            lifetime.StopApplication();
        }

        public static IHost MigrateDbContext<TContext>(this IHost host, Action<TContext, IServiceProvider> seeder) where TContext : DbContext
        {
            using (var scope = host.Services.CreateScope())
            {
                var services = scope.ServiceProvider;
                var logger = services.GetRequiredService<ILogger<TContext>>();
                var context = services.GetRequiredService<TContext>();

                try
                {
                    logger.LogInformation("Migrating database associated with context {DbContextName}", typeof(TContext).Name);
                    InvokeSeeder(seeder, context, services);
                    logger.LogInformation("Migrated database associated with context {DbContextName}", typeof(TContext).Name);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "An error occurred while migrating the database used on context {DbContextName}", typeof(TContext).Name);
                    throw;
                }
            }

            return host;
        }

        public static IApplicationBuilder MigrateDbContext<TContext>(this IApplicationBuilder app, Action<TContext, IServiceProvider> seeder) where TContext : DbContext
        {
            using (var scope = app.ApplicationServices.CreateScope())
            {
                var services = scope.ServiceProvider;
                var logger = services.GetRequiredService<ILogger<TContext>>();
                var context = services.GetRequiredService<TContext>();

                try
                {
                    logger.LogInformation("Migrating database associated with context {DbContextName}", typeof(TContext).Name);
                    InvokeSeeder(seeder, context, services);
                    logger.LogInformation("Migrated database associated with context {DbContextName}", typeof(TContext).Name);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "An error occurred while migrating the database used on context {DbContextName}", typeof(TContext).Name);
                    throw;
                }
            }
            return app;
        }

        private static void InvokeSeeder<TContext>(Action<TContext, IServiceProvider> seeder, TContext context, IServiceProvider services)
            where TContext : DbContext
        {
            context.Database.Migrate();
            seeder(context, services);
        }
    }
}
