-- ============================================================
-- V1__schema.sql
-- ANSI SQL Schema for CineBook (Compatible with PostgreSQL & H2)
-- ============================================================

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  full_name   VARCHAR(255),
  phone       VARCHAR(255),
  role        VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER'
                CHECK (role IN ('CUSTOMER', 'ADMIN')),
  avatar_url  VARCHAR(255),
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- TABLE: movies
-- ============================================================
CREATE TABLE IF NOT EXISTS movies (
  id               UUID PRIMARY KEY,
  title            VARCHAR(255) NOT NULL,
  description      VARCHAR(4000),
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  genre            VARCHAR(100) NOT NULL,
  language         VARCHAR(100) NOT NULL DEFAULT 'English',
  poster_url       VARCHAR(1000),
  backdrop_url     VARCHAR(1000),
  trailer_url      VARCHAR(1000),
  rating           DECIMAL(3,1) CHECK (rating >= 0 AND rating <= 10),
  vote_count       INT,
  release_date     DATE NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  tmdb_id          INT,
  imdb_id          VARCHAR(50),
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movies_release_date ON movies(release_date);
CREATE INDEX idx_movies_is_active    ON movies(is_active);
CREATE INDEX idx_movies_genre        ON movies(genre);

-- ============================================================
-- TABLE: theaters
-- ============================================================
CREATE TABLE IF NOT EXISTS theaters (
  id         UUID PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  city       VARCHAR(100) NOT NULL,
  address    VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_theaters_city ON theaters(city);

-- ============================================================
-- TABLE: screens
-- ============================================================
CREATE TABLE IF NOT EXISTS screens (
  id            UUID PRIMARY KEY,
  theater_id    UUID NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  total_rows    INT NOT NULL CHECK (total_rows > 0),
  total_columns INT NOT NULL CHECK (total_columns > 0),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_screens_theater_id ON screens(theater_id);

-- ============================================================
-- TABLE: seats
-- ============================================================
CREATE TABLE IF NOT EXISTS seats (
  id          UUID PRIMARY KEY,
  screen_id   UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  row_label   VARCHAR(10) NOT NULL,
  seat_number INT NOT NULL,
  seat_type   VARCHAR(50) NOT NULL DEFAULT 'REGULAR'
                CHECK (seat_type IN ('REGULAR', 'PREMIUM', 'RECLINER')),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (screen_id, row_label, seat_number)
);

CREATE INDEX idx_seats_screen_id ON seats(screen_id);

-- ============================================================
-- TABLE: shows
-- ============================================================
CREATE TABLE IF NOT EXISTS shows (
  id         UUID PRIMARY KEY,
  movie_id   UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  screen_id  UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  start_time TIMESTAMP NOT NULL,
  end_time   TIMESTAMP NOT NULL,
  base_price INT NOT NULL CHECK (base_price > 0),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_time > start_time)
);

CREATE INDEX idx_shows_movie_start ON shows(movie_id, start_time);
CREATE INDEX idx_shows_screen_id   ON shows(screen_id);
CREATE INDEX idx_shows_start_time  ON shows(start_time);
CREATE INDEX idx_shows_is_active   ON shows(is_active);

-- ============================================================
-- TABLE: show_seats — THE CONCURRENCY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS show_seats (
  id              UUID PRIMARY KEY,
  show_id         UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  seat_id         UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  price           INT NOT NULL CHECK (price > 0),
  status          VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE'
                    CHECK (status IN ('AVAILABLE', 'LOCKED', 'BOOKED')),
  locked_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  locked_at       TIMESTAMP,
  lock_expires_at TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (show_id, seat_id)
);

CREATE INDEX idx_show_seats_show_id     ON show_seats(show_id);
CREATE INDEX idx_show_seats_status      ON show_seats(status);
CREATE INDEX idx_show_seats_show_status ON show_seats(show_id, status);

-- ============================================================
-- TABLE: bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  show_id      UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  status       VARCHAR(50) NOT NULL DEFAULT 'CREATED'
                 CHECK (status IN ('CREATED', 'CONFIRMED', 'CANCELLED', 'EXPIRED')),
  total_amount INT NOT NULL CHECK (total_amount > 0),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_user_id     ON bookings(user_id);
CREATE INDEX idx_bookings_show_id     ON bookings(show_id);
CREATE INDEX idx_bookings_status      ON bookings(status);
CREATE INDEX idx_bookings_user_status ON bookings(user_id, status);

-- ============================================================
-- TABLE: booking_seats
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_seats (
  id            UUID PRIMARY KEY,
  booking_id    UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  show_seat_id  UUID NOT NULL REFERENCES show_seats(id) ON DELETE CASCADE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (booking_id, show_seat_id)
);

CREATE INDEX idx_booking_seats_booking_id   ON booking_seats(booking_id);
CREATE INDEX idx_booking_seats_show_seat_id ON booking_seats(show_seat_id);

-- ============================================================
-- TABLE: payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY,
  booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount              INT NOT NULL CHECK (amount > 0),
  method              VARCHAR(100),
  status              VARCHAR(50) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  provider_order_id   VARCHAR(255),
  provider_payment_id VARCHAR(255),
  provider_signature  VARCHAR(255),
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_status     ON payments(status);

-- ============================================================
-- TABLE: refresh_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(500) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token   ON refresh_tokens(token);
