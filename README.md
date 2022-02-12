# FedEx Bulk Dropship Label Creator

Creates FedEx shipping labels in bulk. Imports a CSV file and creates a shipping
label for each entry. Saves a new CSV which can be imported into Excel with
required information and tracking numbers. 

Uses FedEx Address Validation API to correct errors in customer addresses before
labels are created. In testing, this reduced failed orders from 1 in 5, to 1 in 
several thousand.

## Installation

1. Download and install [Node.js](https://nodejs.org/en/download/) with default
   settings. Restart computer when installation is complete.
1. Clone this repo or [download the .ZIP](https://github.com/bwookieeeee/fedex-bulk-shipping/archive/refs/heads/main.zip).
   Extract where appropriate.
1. Open terminal, navigate to folder where this repo is installed.
1. Run command: `npm i`
1. Rename `config.example.js` to `config.js` and populate with information from
   your project overview on FedEx.

## Usage

A file called `run.bat` is available for quick running, or running `npm start` or
`node .` in a terminal.

If the `.bat` file is used, after the script finishes creating all labels, 
Explorer is meant to open into the directory where the shipping labels are saved.
If the script is ran in the terminal, labels are found at `/path/to/shipper/labels`

Default behavior is to use a CSV file called `unshipped.csv` in the same directory
as the script. Specifying the file in the command line arguments is a planned
feature.

Once the script is complete, a CSV file called `completedOrders.csv` is created
in the current working directory.

### Optional Arguments

| Argument | Desc | Example |
| -------- | ---- | ------- |
| `-i`, `--input` | Path to the CSV of unshipped orders | `-i %USERPROFILE\Documents\bambu-052800.csv` |
| `-o`, `--output` | Path to the CSV of shipped orders | `-o ..\lindemann-100020-shipped.csv` |

### Example

A CSV file with information including but not limited to:

| `billingAccount` | `orderNum` | `company` | `firstName` | `lastName` | `address1` | `address2` | `city` | `state` | `country` | `zip` | `phone` | `shipDate` | `serviceType` | `packagingType` | `weight` | `len` | `width` | `height` |
| ---------------- | ---------- | --------- | ----------- | ---------- | ---------- | ---------- | ------ | ------- | --------- | ----- | ------- | ---------- | ------------- | --------------- | -------- | ----- | ------- | -------- |
| 012345678 | 1234 | Relay Resources | Brooke | Morrison | 5312 NE 148th AVE | | Portland | OR | US | 97230 | 5032611226 | 2022-03-20 | FEDEX_GROUND | YOUR_PACKAGING | 1 | 14 | 15 | 11 |

will result in a CSV with:

| `billingAccount` | `orderNum` | `company` | `firstName` | `lastName` | `address1` | `address2` | `city` | `state` | `zip` | `phone` | `trackingNumber` |
| ---------------- | ---------- | --------- | ----------- | ---------- | ---------- | ---------- | ------ | ------- | ----- | ------- | ---------------- |
| 012345678 | 1234 | Relay Resources | Brooke | Morrison | 5312 NE 148th AVE | | Portland | OR | 97230 | 5032611266 | 12345678901234 |

Any failed orders will print their order number at the end of the script to allow 
the operator to reference those entries to manually create a shipping label.

## Required CSV header names

The FedEx shipping API will not create a label without `billingAccount`, 
`address1`, `city`, `state`, `country`, `phone`, `serviceType` `packagingType`,
`weight`, `len`, `width`, `height`. It is OK to leave the other fields empty,
but omitting their columns may result in unexpected behavior. 

## Special Enums
Check [here](https://developer.fedex.com/api/en-us/guides/api-reference.html)
for the most up to date enums.

Columns listed here will only accept certain values:

| key | accepted values |
| --- | --------------- |
| `state` | `AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR` |
| `country` | `AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI KH CM CA CV CF TD CL CN CX CC CO KM CG CD CK CR HR CU CW CY CZ DK DJ DM DO TC EX EG SV GB GQ ER EE ET FO FK FJ FI FR GF TF GA GM GE DE GH GI KY VG GR GL GD GP GU GT GN GW GY HT HM MN HK HU IS IN ID IR IQ IE IL IT CI JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MK MG MW MY ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF KP MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW WS ST SA SN RS SC SL SG SK SI SB SO ZA GS KR ES LK BL KN VI SH LC SX MF PM VC SD SR SJ SZ SE CH SY PF TW TJ TZ TH TG TK TO TT TN TR TM TC TV UM UG UA AE US UY UZ VU VE VN WF EH YE ZM ZW` |
| `pickupType` | `CONTACT_FEDEX_TO_SCHEDULE DROPOFF_AT_FEDEX_LOCATION USE_SCHEDULED_PICKUP ON_CALL PACKAGE_RETURN_PROGRAM REGULAR_STOP TAG` |
| `serviceType` | `FEDEX_2_DAY FEDEX_2_DAY_AM FEDEX_CUSTOM_CRITICAL_CHARTER_AIR FEDEX_CUSTOM_CRITICAL_AIR_EXPEDITE FEDEX_CUSTOM_CRITICAL_AIR_EXPEDITE_EXCLUSIVE_USE FEDEX_CUSTOM_CRITICAL_AIR_EXPEDITE_NETWORK FEDEX_CUSTOM_CRITICAL_POINT_TO_POINT FEDEX_CUSTOM_CRITICAL_SURFACE_EXPEDITE FEDEX_CUSTOM_CRITICAL_SERVICE_EXPEDITE_EXCLUSIVE_USE EUROPE_FIRST_INTERNATIONAL_PRIORITY FEDEX_EXPRESS_SAVER FIRST_OVERNIGHT FEDEX_FIRST_OVERNIGHT_EXTRA_HOURS FEDEX_GROUND GROUND_HOME_DELIVERY FEDEX_CARGO_AIRPORT_TO_AIRPORT FEDEX_INTERNATIONAL_CONNECT_PLUS INTERNATIONAL_ECONOMY INTERNATIONAL_ECONOMY_DISTRIBUTION INTERNATIONAL_FIRST FEDEX_CARGO_MAIL FEDEX_CARGO_INTERNATIONAL_PREMIUM INTERNATIONAL_PRIORITY PRIORITY_OVERNIGHT_EXTRA_HOURS SAME_DAY SAME_DAY_CITY SMART_POST FEDEX_STANDARD_OVERNIGHT_EXTRA_HOURS STANDARD_OVERNIGHT TRANSBORDER_DISTRIBUTION_CONSOLIDATION FEDEX_CUSTOM_CRITICAL_TEMP_ASSURE_AIR FEDEX_CUSTOM_CRITICAL_TEMP_ASSURE_VALIDATED_AIR FEDEX_CUSTOM_CRITICAL_WHITE_GLOVE_SERVICES FEDEX_REGIONAL_ECONOMY FEDEX_REGIONAL_ECONOMY_FREIGHT FEDEX_INTERNATIONAL_PRIORITY FEDEX_1_DAY_FREIGHT FEDEX_2_DAY_FREIGHT FEDEX_3_DAY_FREIGHT FIRST_OVERNIGHT_FREIGHT FEDEX_NEXT_DAY_AFTERNOON FEDEX_NEXT_DAY_EARLY_MORNING FEDEX_NEXT_DAY_END_OF_DAY INTERNATIONAL_ECONOMY_FREIGHT INTERNATIONAL_PRIORITY_FREIGHT` |
| `packagingType` | `YOUR_PACKAGING FEDEX_ENVELOPE FEDEX_BOX FEDEX_SMALL_BOX FEDEX_MEDIUM_BOX FEDEX_LARGE_BOX FEDEX_EXTRA_LARGE_BOX FEDEX_10KG_BOX FEDEX_25KG_BOX FEDEX_PAK FEDEX_TUBE` |

---

_Created by [Brooke Morrison](mailto:bmorrison@relayresources.org) on behalf of
[Relay Resources](httsp://relayresources.org) ©2022 Brooke Morrison, Relay
Resources - All Rights Reserved._
