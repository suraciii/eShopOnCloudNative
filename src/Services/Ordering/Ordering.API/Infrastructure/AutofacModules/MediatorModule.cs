using System.Reflection;
using MediatR;
using Microsoft.eShopOnContainers.Services.Ordering.API.Application.Commands;
using Microsoft.Extensions.DependencyInjection;
using Ordering.API.Application.Behaviors;
using Ordering.API.Application.DomainEventHandlers.OrderStartedEvent;
using Ordering.API.Application.Validations;

namespace Microsoft.eShopOnContainers.Services.Ordering.API.Infrastructure.AutofacModules
{
    public static class MediatorServiceCollectionExtensions
    {
        public static IServiceCollection AddMediatorModule(this IServiceCollection services)
        {
            services.AddMediatR(
                typeof(CreateOrderCommand).GetTypeInfo().Assembly,
                typeof(ValidateOrAddBuyerAggregateWhenOrderStartedDomainEventHandler).GetTypeInfo().Assembly,
                typeof(CreateOrderCommandValidator).GetTypeInfo().Assembly
                //typeof(LoggingBehavior<,>).GetTypeInfo().Assembly,
                //typeof(ValidatorBehavior<,>).GetTypeInfo().Assembly,
                //typeof(TransactionBehaviour<,>).GetTypeInfo().Assembly,
            );

            //services.AddScoped(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            //services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidatorBehavior<,>));
            //services.AddScoped(typeof(IPipelineBehavior<,>), typeof(TransactionBehaviour<,>));
            return services;
        }
    }
}