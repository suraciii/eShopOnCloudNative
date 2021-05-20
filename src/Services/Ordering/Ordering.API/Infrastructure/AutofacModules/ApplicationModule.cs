using System.Linq;
using System.Reflection;
using Autofac;
using Microsoft.eShopOnContainers.BuildingBlocks.EventBus.Abstractions;
using Microsoft.eShopOnContainers.BuildingBlocks.EventBus.Events;
using Microsoft.eShopOnContainers.Services.Ordering.API.Application.Commands;
using Microsoft.eShopOnContainers.Services.Ordering.API.Application.Queries;
using Microsoft.eShopOnContainers.Services.Ordering.Domain.AggregatesModel.BuyerAggregate;
using Microsoft.eShopOnContainers.Services.Ordering.Domain.AggregatesModel.OrderAggregate;
using Microsoft.eShopOnContainers.Services.Ordering.Infrastructure.Idempotency;
using Microsoft.eShopOnContainers.Services.Ordering.Infrastructure.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace Microsoft.eShopOnContainers.Services.Ordering.API.Infrastructure.AutofacModules
{
    public static class ApplicationServiceCollectionExtensions
    {
        public static IServiceCollection AddApplicationModule(this IServiceCollection services, string qconstr)
        {

            services.AddScoped<IOrderQueries>(c => new OrderQueries(qconstr));

            services.AddScoped<IBuyerRepository, BuyerRepository>();

            services.AddScoped<IOrderRepository, OrderRepository>();

            services.AddScoped<IRequestManager, RequestManager>();

            services.AddTransient<IRequestManager, RequestManager>();

            services.RegisterIntegrationEventHandlers(typeof(CreateOrderCommandHandler).GetTypeInfo().Assembly);

            return services;
        }

        public static IServiceCollection RegisterIntegrationEventHandlers(this IServiceCollection services, Assembly assembly)
        {
            var assemblyTypes = assembly.GetExportedTypes();
            var eventTypes = assemblyTypes.Where(t => t.IsClass && t.GetInterface(typeof(IntegrationEvent).Name) is not null);
            var tuples = eventTypes.Select(eventType =>
            {
                var handlerInterfaceType = typeof(IIntegrationEventHandler<>).MakeGenericType(eventType);
                return (eventType, handlerInterfaceType);
            });

            foreach (var (eventType, handlerInterfaceType) in tuples)
            {
                var handlerImplemention = assemblyTypes
                    .Single(t => t.IsClass && handlerInterfaceType.IsAssignableFrom(t));
                services.AddTransient(handlerInterfaceType, handlerImplemention);
            }
            return services;
        }
    }

}
