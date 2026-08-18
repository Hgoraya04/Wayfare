DROP TABLE IF EXISTS itinerary_stop;
DROP TABLE IF EXISTS itinerary_day;
DROP TABLE IF EXISTS trip;
DROP TABLE IF EXISTS usercredentials;

CREATE TABLE usercredentials (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  fullName VARCHAR(100),
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per generated trip. The preference blob the user submitted is kept
-- verbatim so a trip can be re-generated later without re-asking the form.
CREATE TABLE trip (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userId INT NOT NULL REFERENCES usercredentials(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  destinationId VARCHAR(64) NOT NULL,
  destinationCity VARCHAR(100) NOT NULL,
  destinationCountry VARCHAR(100) NOT NULL,
  startDate DATE,
  endDate DATE,
  flexibleMonth VARCHAR(20),
  durationDays INT NOT NULL,
  travelers INT NOT NULL DEFAULT 1,
  budgetAmount NUMERIC(10, 2) NOT NULL,
  budgetCurrency CHAR(3) NOT NULL DEFAULT 'USD',
  estimatedCost NUMERIC(10, 2),
  tripStyles TEXT[] NOT NULL DEFAULT '{}',
  cuisines TEXT[] NOT NULL DEFAULT '{}',
  baggage VARCHAR(20) NOT NULL DEFAULT 'carry_on',
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE itinerary_day (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tripId INT NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  dayNumber INT NOT NULL,
  areaName VARCHAR(150),
  summary TEXT,
  UNIQUE (tripId, dayNumber)
);

-- Stops are ordered within a day by sortOrder, not by clock time, so a user
-- can drag one earlier without us having to recompute every visit time.
CREATE TABLE itinerary_stop (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dayId INT NOT NULL REFERENCES itinerary_day(id) ON DELETE CASCADE,
  sortOrder INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'attraction',
  suggestedTime VARCHAR(20),
  durationMinutes INT,
  notes TEXT,
  address VARCHAR(300),
  lat NUMERIC(9, 6),
  lon NUMERIC(9, 6),
  priceLevel INT,
  rating NUMERIC(2, 1),
  googlePlaceId VARCHAR(300)
);

CREATE INDEX idx_trip_user ON trip(userId);
CREATE INDEX idx_day_trip ON itinerary_day(tripId);
CREATE INDEX idx_stop_day ON itinerary_stop(dayId);
