package com.nextcms.productdemo.security;

import java.util.List;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.proc.DefaultJOSEObjectTypeVerifier;
import com.nimbusds.jose.proc.SecurityContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoderInitializationException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.SupplierJwtDecoder;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Stateless OAuth2 resource server. The API trusts only a valid bearer token
 * (issued by the identity provider and added by the Next.js server); it never
 * sees the browser's session cookie and has no login logic of its own.
 *
 * <p>What is protected: everything under {@code /api/**}. The product demo
 * endpoints ({@code /demo/**}), the stored files ({@code /uploads/**}) and the
 * H2 console stay open, exactly as before this was added, so the product form
 * keeps working without a login. Tighten that list when those need auth too.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

  @Bean
  SecurityFilterChain api(HttpSecurity http) throws Exception {
    http
        .csrf(csrf -> csrf.disable()) // stateless: bearer token only, no cookies to forge
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        // The H2 console renders in frames of its own origin.
        .headers(h -> h.frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin))
        .authorizeHttpRequests(a -> a
            .requestMatchers("/demo/**", "/uploads/**", "/h2-console/**", "/error").permitAll()
            .requestMatchers("/actuator/health/**").permitAll()
            .anyRequest().authenticated())
        .oauth2ResourceServer(o -> o.jwt(j -> { }).authenticationEntryPoint(entryPoint()));
    return http.build();
  }

  /**
   * Validates the signature (keys fetched from the issuer's JWKS), iss, exp, nbf and aud.
   *
   * <p>Created lazily: the issuer's discovery document is only fetched on the
   * first token, so this API still starts (and the open endpoints still work)
   * when the identity provider is down or not configured yet.
   */
  @Bean
  JwtDecoder jwtDecoder(
      @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
      @Value("${ibe.security.audience}") String audience) {
    JwtDecoder lazy = new SupplierJwtDecoder(() -> {
      NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(issuer)
          // Spring's default only accepts the JOSE header typ "JWT". Some identity
          // providers (Auth0, Duende, anything following RFC 9068) sign access tokens
          // with typ "at+jwt", which would be rejected as "type not allowed".
          .jwtProcessorCustomizer(processor -> processor.setJWSTypeVerifier(
              new DefaultJOSEObjectTypeVerifier<SecurityContext>(
                  JOSEObjectType.JWT, new JOSEObjectType("at+jwt"), null)))
          .build();
      decoder.setJwtValidator(tokenValidator(issuer, audience));
      return decoder;
    });
    // If the identity provider cannot be reached to fetch its keys, say so (503, see
    // entryPoint()) instead of letting an unhandled exception become a 500.
    return token -> {
      try {
        return lazy.decode(token);
      } catch (JwtDecoderInitializationException e) {
        throw new IdentityProviderUnavailableException(e);
      }
    };
  }

  /**
   * 401 (with the standard WWW-Authenticate challenge) for a missing or invalid
   * token. 503 when the token could not be checked because the identity provider
   * is down: the caller is not necessarily logged out, so it must not be told to
   * log in again.
   */
  private static AuthenticationEntryPoint entryPoint() {
    BearerTokenAuthenticationEntryPoint bearer = new BearerTokenAuthenticationEntryPoint();
    return (request, response, ex) -> {
      if (ex instanceof IdentityProviderUnavailableException) {
        response.setStatus(503);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"identity_provider_unavailable\"}");
        return;
      }
      bearer.commence(request, response, ex);
    };
  }

  /**
   * Deliberately NOT an AuthenticationServiceException: Spring rethrows those
   * (to avoid hiding infrastructure failures as a 401), so the entry point above
   * would never see it.
   */
  static class IdentityProviderUnavailableException extends AuthenticationException {
    IdentityProviderUnavailableException(Throwable cause) {
      super("Identity provider unavailable", cause);
    }
  }

  /** iss + exp + nbf (defaults) AND aud must contain this API's audience. */
  static OAuth2TokenValidator<Jwt> tokenValidator(String issuer, String audience) {
    return new DelegatingOAuth2TokenValidator<>(
        JwtValidators.createDefaultWithIssuer(issuer), audienceValidator(audience));
  }

  static OAuth2TokenValidator<Jwt> audienceValidator(String audience) {
    return new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.contains(audience));
  }
}
