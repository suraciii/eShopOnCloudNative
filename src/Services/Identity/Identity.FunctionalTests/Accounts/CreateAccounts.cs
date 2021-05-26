using System.Threading.Tasks;
using Xunit;

namespace Identity.FunctionalTests.Accounts
{
    public class CreateAccounts : IClassFixture<WAF>
    {
        private readonly WAF _waf;

        public CreateAccounts(WAF waf)
        {
            this._waf = waf;
        }

        [Fact]
        public async Task CreateAccount()
        {

            var client = _waf.CreateClient();
            var res = await client.GetAsync("/api/v1/accounts");
        }

    }

}