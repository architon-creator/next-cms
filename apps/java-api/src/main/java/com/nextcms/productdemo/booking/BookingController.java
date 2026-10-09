package com.nextcms.productdemo.booking;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Example of an endpoint behind the login. The caller is identified ONLY by the
 * validated token's subject: never take a user id from the request body, query
 * string or headers.
 */
@RestController
@RequestMapping("/api/bookings")
class BookingController {

  /** Who the token says the caller is. */
  @GetMapping("/me")
  Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("sub", jwt.getSubject());
    body.put("email", jwt.getClaimAsString("email"));
    body.put("scope", jwt.getClaimAsString("scope"));
    return body;
  }

  /**
   * Needs the {@code booking.read} scope. The default converter maps the token's
   * {@code scope} / {@code scp} claim to {@code SCOPE_<name>} authorities; if the
   * vendor sends roles in a custom claim, add a JwtAuthenticationConverter that reads it.
   */
  @GetMapping
  @PreAuthorize("hasAuthority('SCOPE_booking.read')")
  Map<String, Object> list(@AuthenticationPrincipal Jwt jwt) {
    // A real service would look bookings up by jwt.getSubject(). There is no
    // booking store in this project yet, so the list is empty.
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("sub", jwt.getSubject());
    body.put("bookings", List.of());
    return body;
  }
}
