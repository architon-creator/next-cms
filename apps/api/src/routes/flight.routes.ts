import { Router } from "express";
import {
  bookFlight,
  getFlight,
  listBookings,
  searchFlights,
} from "../controllers/flight.controller.js";

export const flightRouter = Router();

flightRouter.get("/", searchFlights);
flightRouter.get("/bookings", listBookings);
flightRouter.get("/:id", getFlight);
flightRouter.post("/bookings", bookFlight);
