# Architecture

`par-ici-tennis` is a Node.js command-line application that automates authenticated interactions with the Paris Tennis website. It has no server, database, or graphical interface. Commands either drive the website through Playwright or call an authenticated website endpoint through the Playwright browser context.

## Commands

| Command | Entry point | Purpose |
| --- | --- | --- |
| `npm run book` | `book.js` | Find and book the first slot matching the configured preferences. |
| `npm run book-dry` | `book.js --dry-run` | Exercise the booking flow, then cancel before payment submission. |
| `npm run search` | `search.js` | Find currently bookable slots matching `config.json`. |
| `npm run planning -- <location> <date>` | `planning.js` | Return `LIBRE` and `PUBLIC` planning slots for one location and date. |
| `npm run planning-export -- <start> <end> [file]` | `planning-export.js` | Export planning slots for every official location as CSV. |
| `npm run wait` | `scripts/wait-8-am.js` | Wait until 08:00 in the Europe/Paris timezone. |
| `npm test` | Node test runner | Run the unit tests. |

Progress messages use standard error. Tables, JSON, and generated data use standard output or the requested output file. Search and planning support `--json` for machine-readable output.

## Main components

### Authentication

`lib/authenticate.js` creates a Playwright page, obtains credentials from `config.json` or environment variables, signs in to Paris Tennis, and waits for authenticated content. All commands that access Paris Tennis share this function. CAPTCHA-related request interception remains encapsulated here.

### Configuration and locations

`lib/config.js` validates user-maintained search and booking preferences: locations, hours, price and court types, optional court-number restrictions, and player records.

`lib/locations.js` discovers current location names and arrondissements from the official Paris Tennis directory. Booking and search validate configured names against this directory before querying availability.

The `locations` value in `config.json` belongs only to booking and availability search. Planning exports deliberately ignore it and dynamically discover every official location.

### Dates and timezone

`lib/dates.js` is the shared date boundary. It accepts padded and unpadded `D/M/YYYY` values, performs strict calendar validation, uses the `Europe/Paris` timezone, and enforces the website's seven-day planning window.

### Availability search

`lib/availability.js` owns the browser interaction with the bookable-slot search page. It opens the page, selects an exact autocomplete location, selects the date, submits the search, and extracts matching court, hour, price, and court-type data.

Location selection handles the autocomplete overlay explicitly and retries a failed location query once. Booking reuses the same search submission function before selecting a result.

### Booking

`book.js` coordinates the state-changing workflow:

1. validate configuration and date;
2. authenticate and validate configured locations;
3. search locations and hours in preference order;
4. filter by court number, price type, and court type;
5. select the first matching slot;
6. enter player and payment information;
7. cancel in dry-run mode or submit the reservation;
8. create an ICS event and optionally send an ntfy notification.

The browser closes in a `finally` block. Failures set a non-zero exit code, attempt to capture a screenshot, and can send that screenshot through ntfy.

### Planning

`lib/planning.js` uses the authenticated Playwright request context to call the website's planning endpoint directly. It parses the returned table and retains only:

- `LIBRE`: currently open for booking;
- `PUBLIC`: already reserved by a member of the public.

Club, school, association, and other allocated slots are excluded. `planning.js` presents one location and date as a terminal table or JSON. `planning-export.js` queries every dynamically discovered location over a date range.

### CSV export

`lib/planning-csv.js` converts planning results into this stable schema:

1. location name;
2. arrondissement;
3. court number;
4. court type;
5. weekday;
6. date;
7. hourly slot;
8. status.

The exporter works sequentially with a short delay, retries transient failures with backoff, and stops after five consecutive failures. Complete exports are written atomically. Incomplete exports use a `.partial.csv` filename and a non-zero exit code.

### Notifications and calendar output

`lib/ntfy.js` sends ICS confirmations and failure screenshots to an optional ntfy topic. The `ics` package generates the calendar event after a confirmed booking.

## Data flows

### Search

```text
config.json
    -> validate configuration and date
    -> authenticate
    -> discover and validate locations
    -> submit availability searches
    -> extract matching slots
    -> terminal table or JSON
```

### Booking

```text
config.json
    -> validate configuration and date
    -> authenticate
    -> discover and validate locations
    -> shared availability search
    -> select first preferred slot
    -> reservation forms
    -> dry-run cancellation OR booking submission
    -> ICS file and optional ntfy notification
```

### Planning export

```text
date range
    -> validate against the Paris seven-day window
    -> authenticate
    -> discover official locations and arrondissements
    -> query each location/date planning
    -> retain LIBRE and PUBLIC slots
    -> atomic CSV or partial CSV on failure
```

## External systems

- Paris Tennis: location directory, availability, planning, and reservations.
- Paris identity service: account authentication used by Paris Tennis.
- ntfy: optional notifications.
- GitHub Actions: scheduled booking, manual dry runs, and pull-request checks.

Paris Tennis is an external website rather than a versioned API. Its DOM selectors and response markup are integration boundaries that may require maintenance when the site changes.

## Testing

Tests under `test/` use Node's built-in test runner. They cover date parsing and ranges, configuration validation, official-location parsing and normalization, and CSV schema and escaping. Pull-request CI runs both ESLint and unit tests. Live authentication and booking are intentionally excluded from pull-request CI.

## Generated and private files

- `config.json` contains private local configuration and is ignored by Git.
- `event.ics` is generated after a local booking and is ignored by Git.
- `img/failure.png` is generated after browser failures and its directory is ignored by Git.
- `planning-*.csv` and `*.partial.csv` are generated exports and are ignored by Git.

`config.json.sample` documents the supported configuration shape without real credentials.
