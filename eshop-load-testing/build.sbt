import Dependencies._

enablePlugins(GatlingPlugin)

lazy val root = (project in file("."))
  .settings(
    inThisBuild(List(
      organization := "eshop.ichnb.com",
      scalaVersion := "2.13.5",
      version := "0.1.0-SNAPSHOT"
    )),
    name := "eshop-load-testing",
    libraryDependencies ++= gatling
  )
