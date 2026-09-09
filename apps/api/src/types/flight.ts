export type Flight = {
  id: string;
  origin: string;
  destination: string;
  departureTime: string;
  price: number;
  seatsAvailable: number;
};

export type Booking = {
  id: string;
  flightId: string;
  passengerName: string;
  seats: number;
  createdAt: string;
};
