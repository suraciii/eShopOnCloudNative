package identity


import io.gatling.core.Predef._
import io.gatling.http.Predef._
import pdi.jwt._

import scala.concurrent.duration._

object AuthRequest {
  val getAccessToken = exec(http("User Login")
    .post("https://eshop.ichnb.com/identity/connect/token")
    .formParam("""username""", "testuser-${userSeq}@test.tt")
    .formParam("""password""", """P@ssw0rd!""")
    .formParam("""grant_type""", """password""")
    .formParam("""scope""", """openid profile orders basket webshoppingagg orders.signalrhub""")
    .headers(Map("Authorization" -> "Basic dGVzdDpzZWNyZXQ="))
    .check(status.is(200))
    .check(jsonPath("$.access_token").transform(jwt => Jwt.decode(jwt, JwtOptions(signature = false, notBefore=false)).get.subject.get).saveAs("userid"))
    .check(jsonPath("$.access_token").saveAs("access_token")))
    .exec {
      session =>
          session("access_token").as[String]
        session
    }
}