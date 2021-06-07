package identity

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class AccountLoginSimulation extends Simulation {

 val httpProtocol = http
   .authorizationHeader("Basic dGVzdDpzZWNyZXQ=")
   .baseUrl("https://eshop.ichnb.com/identity") // Here is the root for all relative URLs

 var userIdFeeder = (1 to 1000).to(LazyList).map(i => Map("userId" -> i)).iterator

 val scn = scenario("userLogin") // A scenario is a chain of requests and pauses
   .feed(userIdFeeder)
   .forever(
     exec(http("userLogin") // Here's an example of a POST request
       .post("/connect/token")
       .formParam("""username""", "testuser-${userId}@test.tt") // Note the triple double quotes: used in Scala for protecting a whole chain of characters (no need for backslash)
       .formParam("""password""", """P@ssw0rd!""")
       .formParam("""grant_type""", """password""")
       .formParam("""scope""", """openid profile basket"""))
   )

 setUp(scn.inject(
   atOnceUsers(10), // 2
   rampUsers(900).during(300.seconds),
 ).protocols(httpProtocol)).maxDuration(360.seconds)
}
