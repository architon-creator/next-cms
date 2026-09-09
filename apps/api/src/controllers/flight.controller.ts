import type { Request, Response } from "express";
import type { Booking, Flight } from "../types/flight.js";

// In-memory placeholder catalog/bookings — replace with a real datastore
// and a proper search/pricing service once this grows beyond a scaffold.
const flights: Flight[] = [
  {
    id: "fl-1",
    origin: "SFO",
    destination: "JFK",
    departureTime: "2026-10-01T09:00:00Z",
    price: 249.99,
    seatsAvailable: 42,
  },
  {
    id: "fl-2",
    origin: "JFK",
    destination: "LHR",
    departureTime: "2026-10-02T20:30:00Z",
    price: 512.5,
    seatsAvailable: 12,
  },
];

const bookings: Booking[] = [];

export function searchFlights(req: Request, res: Response) {
  const { origin, destination } = req.query;

  const results = flights.filter(
    (flight) =>
      (!origin || flight.origin === origin) &&
      (!destination || flight.destination === destination),
  );

  res.json(results);
}

export function getFlight(req: Request, res: Response) {
  const flight = flights.find((f) => f.id === req.params.id);
  if (!flight) {
    return res.status(404).json({ error: "Flight not found" });
  }
  res.json(flight);
}

export function bookFlight(req: Request, res: Response) {
  const { flightId, passengerName, seats = 1 } = req.body as Partial<Booking>;

  if (!flightId || !passengerName) {
    return res.status(400).json({ error: "flightId and passengerName are required" });
  }

  const flight = flights.find((f) => f.id === flightId);
  if (!flight) {
    return res.status(404).json({ error: "Flight not found" });
  }
  if (flight.seatsAvailable < seats) {
    return res.status(409).json({ error: "Not enough seats available" });
  }

  flight.seatsAvailable -= seats;

  const booking: Booking = {
    id: `bk-${bookings.length + 1}`,
    flightId,
    passengerName,
    seats,
    createdAt: new Date().toISOString(),
  };
  bookings.push(booking);

  res.status(201).json(booking);
}

export function listBookings(_req: Request, res: Response) {
  res.json(bookings);
}
