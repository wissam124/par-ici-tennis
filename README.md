# par-ici-tennis (*Parisii tennis*)

Script to automatically book a tennis court in Paris (on https://tennis.paris.fr)

See [ARCHITECTURE.md](ARCHITECTURE.md) for the package structure and command data flows.

> "Par ici" mean "this way" in french. The "Parisii" were a Gallic tribe that dwelt on the banks of the river Seine. They lived on lands now occupied by the modern city of Paris. The project name can be interpreted as "For a Parisian tennis, follow this way"

**NOTE**: They added a CAPTCHA during the reservation process. The latest version **should** pass through. If it fails, open an issue with error logs, I will try to find another way.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Get started](#get-started)
  - [Configuration](#configuration)
  - [Searching availability](#searching-availability)
  - [Querying a tennis planning](#querying-a-tennis-planning)
  - [Ntfy notifications (optional)](#ntfy-notifications-optional)
  - [Payment process](#payment-process)
  - [Running](#running)
    - [On your machine](#on-your-machine)
    - [Using GitHub Actions (beta)](#using-github-actions-beta)
- [Contributing](#contributing)
- [License](#license)

## Prerequisites
- Node.js >= 20.6.x
- A "carnet de réservation" in your Paris Tennis account (see [Payment process](#payment-process))

## Get started

### Configuration

Create `config.json` file from `config.json.sample` and complete with your preferences.

- `locations`: a list of courts ordered by preference - [full list](https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=tennisParisien&view=les_tennis_parisiens)

You can use two formats for the `locations` field:

1) **Array format:**
  ```json
  "locations": [
    "Valeyre",
    "Suzanne Lenglen",
    "Poliveau"
  ]
  ```
  Use this if you want to search all courts at each location, in order of preference.

2) **Object format (with court numbers):**
  ```json
  "locations": {
    "Suzanne Lenglen": [5, 7, 11],
    "Henry de Montherlant": []
  }
  ```
  Use this if you want to specify court numbers for each location. An empty array means all courts at that location will be considered.

Choose the format that best matches your preferences.

Before searching or booking, the configured location names are checked against the current official Paris Tennis directory. The command stops and reports any invalid names.

- `date` (optional) a string representing a date formatted D/M/YYYY, do not set the date to automatically book 6 days in the future as soon as the reservation slots open

- `hours` a list of hours ordered by preference. Single-digit hours can be written as either `"9"` or `"09"`

- `priceType` an array containing price types you can book `Tarif plein` and/or `Tarif réduit`

- `courtType` an array containing court types you can book `Découvert` and/or `Couvert`

- `logLocationNames` (optional) set to `true` to show exact location names in GitHub Actions logs. They are anonymized there by default; local command-line runs always show them

- `players` list of players 3 max (without you)

### Searching availability

To search without booking, set `date`, `hours`, and `locations` in `config.json`, then run:

```sh
npm run search
```

The command logs in to Paris Tennis, reports progress for each configured location and hour, then prints the full list of available courts as a terminal table. It does not select or reserve a slot. Add `--json` to receive machine-readable JSON instead:

```sh
npm run search -- --json
```

Example JSON output:

```json
[
  {
    "location": "Valeyre",
    "court": "Court N°1",
    "courtNumber": 1,
    "courtId": "123",
    "date": "31/07/2026",
    "hour": "10",
    "available": true,
    "priceType": "Tarif plein",
    "courtType": "Couvert"
  }
]
```

Only slots exposed as bookable by the Paris Tennis results page are returned. If no matching slots are available, the table command reports that none were found; JSON mode prints an empty array. The object form of `locations` can be used to limit results to particular court numbers.

### Querying a tennis planning

To return all `LIBRE` and `PUBLIC` slots from a tennis planning, provide the location and date on the command line:

```sh
npm run planning -- "Poliveau" "05/09/2026"
```

The date must be today or one of the following six days. The command prints a terminal table containing the hourly range, physical court, court type (`Couvert` or `Découvert`), status, and—when exposed for a `PUBLIC` slot—the reservation details. Add `--json` to receive machine-readable JSON instead:

```sh
npm run planning -- "Poliveau" "05/09/2026" --json
```

Example JSON output:

```json
[
  {
    "location": "Poliveau",
    "date": "05/09/2026",
    "time": "08h - 09h",
    "court": "Court 01",
    "courtType": "Couvert",
    "status": "PUBLIC",
    "details": "Réservé le 02.09.2026 20:00"
  }
]
```

To export every official tennis location over a date range as CSV, run:

```sh
npm run planning-export -- "04/09/2026" "10/09/2026"
```

The exporter discovers the current location names and arrondissements directly from the Paris Tennis directory. It does not use `config.locations`; that setting remains reserved for the locations used by search and booking. Exported rows include the court type and the `LIBRE` or `PUBLIC` status so they can be filtered reliably. Both dates must fall within the current seven-day planning window. An optional third argument sets the output filename.

Exports are written atomically. If any location/date query still fails after retrying, the incomplete result is written with `.partial.csv` in its filename and the command exits with an error.

### Ntfy notifications (optional)

You can configure the script to send notifications with the reservation details and the ics file via [ntfy](https://ntfy.sh), a simple pub-sub notification service.

To receive notifications:
- Choose a unique topic name (e.g., `YOUR-UNIQUE-TOPIC-NAME` — choose something unique and hard to guess, as there is no password protection for subscriptions)
- Subscribe to your topic using the [ntfy mobile app](https://ntfy.sh/docs/subscribe/phone/) or [web interface](https://ntfy.sh/)

To enable ntfy notifications in script, add the following configuration to your `config.json`:

```json
"ntfy": {
  "enable": true,
  "topic": "YOUR-UNIQUE-TOPIC-NAME"
}
```

Configuration options:
- `enable`: set to `true` to enable ntfy notifications
- `topic`: your unique ntfy topic name chosen previously
- `domain` (optional): custom ntfy server domain (`ntfy.sh` used if empty)

Notification example:

![Notification example](doc/ntfy.png)

### Payment process

To pass the payment phase without trouble you need a "carnet de réservation", be careful you need a "carnet" that matches your `priceType` & `courtType` [combination](https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=rate&view=les_tarifs) selected previously

### Running

#### <ins>On your machine</ins>

To run this project locally, install the dependencies

```sh
npm install
```

and run the booking script:

```sh
npm run book
```

To test your configuration, you can run this project in dry-run mode. It creates a temporary court selection, exercises the booking form without submitting the final reservation, and then cancels the selection:

```sh
npm run book-dry
```

The booking log starts with the resolved date, requested hours, and a table with one row per configured location and court. It then shows each available configured court's full description, price type, and covered/open type as it is checked, why an incompatible candidate is skipped, and which matching court is selected. Location names are anonymized in GitHub Actions logs unless `logLocationNames` is `true`.

The dry run verifies cancellation by returning to the availability search page. If it cannot confirm that the temporary server-side selection was cleared, it exits with an error and tells you to cancel the pending reservation from the Paris Tennis website before trying again.

If a booking search completes normally but finds no matching court, the command reports that no reservation was made. In GitHub Actions this appears as a warning while the workflow remains successful; red failures are reserved for configuration, authentication, website interaction, booking, or cleanup errors.

The previous `npm start` and `npm run start-dry` commands remain available as aliases for backward compatibility.

You can start the script automatically using cron or equivalent

#### <ins>Using GitHub Actions (beta)</ins>

> [!IMPORTANT]
> Due to GitHub Actions limitations during high load on their servers, scheduled triggers may not run exactly at 08:00. Improvements are in progress to make the booking more reliable even with a slight delay.
>
> For perfect timing, consider using your [own server or computer](#On-your-machine).

You can automate the booking using GitHub Actions workflows. The repository includes pre-configured workflows:

1. **[Fork this repository](https://github.com/bertrandda/par-ici-tennis/fork)** to your own GitHub account (if you find this repository useful, you can also give it a star ⭐)

2. **Configure GitHub secrets and variables:**
   - Go to your repository Settings → Secrets and variables → Actions
   - Add the following **secrets**:
     - `ACCOUNT_EMAIL`: your Paris Tennis email
     - `ACCOUNT_PASSWORD`: your Paris Tennis password
     - `NTFY_TOPIC`: (optional) your ntfy topic for notifications
     - `NTFY_DOMAIN`: (optional) custom ntfy server domain if you don't use `ntfy.sh`
   - Add a **variable**:
     - `CONFIG_JSON`: the content of your `config.json` file (⚠️ without account credentials and ntfy config for security reasons). Without date line to always book 6 days in advance

3. **Enable workflow:**
   - The day before you want to execute the script, go to the Actions tab and enable the `Tennis booking` workflow
   - GitHub starts the workflow at 07:45 Paris time the following day; after setup, the script waits until 08:00 before searching for a court
   - The workflow automatically disables itself after the attempt—even if setup or booking fails—to prevent it from accidentally booking for a different day on a later run. Check the result in the Actions tab and re-enable it manually when needed

To test Github Actions config you can start `Tennis booking dry-run` workflow manually. It will check court availability but no reservations will be made.

## Contributing

Contributions and bug reports are welcome! Please open an [issue](https://github.com/bertrandda/par-ici-tennis/issues) or submit a [pull request](https://github.com/bertrandda/par-ici-tennis/pulls).

## License

MIT
