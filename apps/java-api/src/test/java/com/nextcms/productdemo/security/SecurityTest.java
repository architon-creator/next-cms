package com.nextcms.productdemo.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;

// The issuer is unreachable on purpose (nothing listens on port 1): the app must
// still start, and the open endpoints must still work, without the identity provider.
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:securitytest;DB_CLOSE_DELAY=-1",
    "app.upload-dir=target/test-uploads",
    "spring.security.oauth2.resourceserver.jwt.issuer-uri=http://localhost:1",
    "ibe.security.audience=ibe-api"
})
@AutoConfigureMockMvc
class SecurityTest {

  @Autowired
  MockMvc mvc;

  // ---------------------------------------------------------- protected: /api/**

  @Test
  void securedEndpointWithoutTokenIs401() throws Exception {
    mvc.perform(get("/api/bookings/me")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/bookings")).andExpect(status().isUnauthorized());
  }

  @Test
  void securedEndpointWithAValidTokenReturnsTheSubject() throws Exception {
    mvc.perform(get("/api/bookings/me")
            .with(jwt().jwt(j -> j.subject("user-1").claim("email", "a@example.com").claim("scope", "openid booking.read"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sub").value("user-1"))
        .andExpect(jsonPath("$.email").value("a@example.com"));
  }

  @Test
  void listNeedsTheBookingReadScope() throws Exception {
    // scope claim present but without booking.read
    mvc.perform(get("/api/bookings").with(jwt().jwt(j -> j.subject("user-1").claim("scope", "openid"))))
        .andExpect(status().isForbidden());
    // with the scope
    mvc.perform(get("/api/bookings")
            .with(jwt().jwt(j -> j.subject("user-1")).authorities(new SimpleGrantedAuthority("SCOPE_booking.read"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sub").value("user-1"))
        .andExpect(jsonPath("$.bookings").isArray());
  }

  @Test
  void identityProviderDownGives503NotAnUnhandledError() throws Exception {
    // The decoder cannot fetch the issuer's keys here. The caller must get a clean
    // 503 (not a 500 stack trace, and not a 401 that would make it log in again).
    mvc.perform(get("/api/bookings/me").header("Authorization", "Bearer not-a-real-token"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.error").value("identity_provider_unavailable"));
  }

  // ------------------------------------------------- still open: product demo

  @Test
  void productDemoEndpointsStayOpen() throws Exception {
    mvc.perform(get("/demo/products/does-not-exist")).andExpect(status().isNotFound());
    // multipart with no parts reaches the controller (its own 400), not a 401/403
    mvc.perform(multipart("/demo/products")).andExpect(status().isBadRequest());
    mvc.perform(get("/uploads/none.jpg")).andExpect(status().isNotFound());
  }

  @Test
  void unknownPathsOutsideTheOpenListNeedALogin() throws Exception {
    mvc.perform(get("/something-else")).andExpect(status().isUnauthorized());
  }

  // ------------------------------------------------------ audience validation

  private static Jwt tokenWithAudience(Object aud) {
    Jwt.Builder b = Jwt.withTokenValue("t").header("alg", "RS256").subject("u")
        .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60));
    if (aud != null) {
      b.claim("aud", aud);
    } else {
      b.claim("x", "y"); // a Jwt needs at least one claim
    }
    return b.build();
  }

  @Test
  void audienceMustContainThisApi() {
    var validator = SecurityConfig.audienceValidator("ibe-api");
    assertThat(validator.validate(tokenWithAudience(List.of("ibe-api"))).hasErrors()).isFalse();
    assertThat(validator.validate(tokenWithAudience(List.of("other", "ibe-api"))).hasErrors()).isFalse();
    assertThat(validator.validate(tokenWithAudience(List.of("other"))).hasErrors()).isTrue();
    assertThat(validator.validate(tokenWithAudience(null)).hasErrors()).isTrue();
  }

  @Test
  void issuerAndExpiryAreCheckedToo() {
    var validator = SecurityConfig.tokenValidator("https://idp.example", "ibe-api");
    Jwt good = Jwt.withTokenValue("t").header("alg", "RS256").issuer("https://idp.example")
        .claim("aud", List.of("ibe-api")).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    Jwt wrongIssuer = Jwt.withTokenValue("t").header("alg", "RS256").issuer("https://evil.example")
        .claim("aud", List.of("ibe-api")).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    Jwt expired = Jwt.withTokenValue("t").header("alg", "RS256").issuer("https://idp.example")
        .claim("aud", List.of("ibe-api")).issuedAt(Instant.now().minusSeconds(600)).expiresAt(Instant.now().minusSeconds(300)).build();
    assertThat(validator.validate(good).hasErrors()).isFalse();
    assertThat(validator.validate(wrongIssuer).hasErrors()).isTrue();
    assertThat(validator.validate(expired).hasErrors()).isTrue();
    assertThat(Map.of()).isEmpty(); // keep the Map import honest if the list above changes
  }
}
