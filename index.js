const { ArgumentParser } = require("argparse");
const { default: axios } = require("axios");
const progress = require("cli-progress");
const { parse } = require("csv-parse/sync");
const fs = require("fs");
const qs = require("qs");

const config = require("./config");
const { version } = require("./package.json");

let shippedOrders = [];
let failedOrders = [];
const bar = new progress.SingleBar();

/**
 * Read input file and return array of objects containing each order
 * 
 * @param {string} file path to input file
 * @returns {Object[]} parsed CSV file of unshipped orders
 */
const parseIncomingFile = file => {
  const f = fs.readFileSync(file);
  return parse(f, { columns: true });
};

/**
 * Main function. Parses command line arguments, calls the authenticator, and
 * iterates through each order, (optionally) verifying each address and writing
 * completed orders to an output CSV. Will print failed orders when finished.
 * 
 * @async
 */
const run = async () => {
  console.log(`
================================================================================
BULK SHIPPING FOR FEDEX

Create FedEx shipping labels in bulk. v${version} created by Brooke
Morrison on behalf of Relay Resources. DO NOT DISTRIBUTE.

Imports a CSV file and creates a shipping label for each entry. Saves a new CSV
which can be imported into Excel with tracking numbers, and basic identifying
information.

Program appearance and behavior subject to change.

Does not actually create shipments, using FedEx sandbox API. No purchases are
being made.
================================================================================
`);

  // Parse command line arguments
  const parser = new ArgumentParser({
    description: "Fedex Bulk Shipping Label Creation Tool"
  });

  parser.add_argument("-i", "--input", {
    help: "path to input CSV",
    default: "unshipped.csv"
  });
  parser.add_argument("-o", "--output", {
    help: "path to output CSV",
    default: "completedOrders.csv"
  });
  const args = parser.parse_args();

  // parse and objectify incoming orders
  const unshippedOrders = parseIncomingFile(args.input);

  bar.start(unshippedOrders.length, 0);

  // Authentication lasts for 1 hour
  const accessToken = await authenticate();

  // Iterate through each order
  for (order of unshippedOrders) {
    // Create the payload
    let address;
    if (config.verifyAddresses) {
      // Address validation is slow, and may not work in prod
      address = await verifyAddress(
        {
          streetLines: [order.address1, order.address2],
          city: order.city,
          stateOrProvinceCode: order.state,
          postalCode: order.zip,
          countryCode: order.country
        },
        accessToken
      );
    } else {
      address = {
        streetLines: [order.address1, order.address2],
        city: order.city,
        stateOrProvinceCode: order.state,
        postalCode: order.zip,
        countryCode: order.country
      };
    }

    // Order will fail if phone number is not exactly 10 digits.
    if (order.phone.length !== 10) order.phone = "5032611266";

    // Check for missing keys, quit when mandatory key not found, otherwise set
    // key value to ""
    if (
      !order.billingAccount ||
      !order.address1 ||
      !order.city ||
      !order.state ||
      !order.country ||
      !order.phone ||
      !order.serviceType ||
      !order.packagingType ||
      !order.weight ||
      !order.len ||
      !order.width ||
      !order.height
    ) {
      bar.stop();
      console.error(
        "One or more mandatory keys were not detected. Fix the issue in Excel and try again."
      );
      process.exit(1);
    }

    if (!order.orderNum) order.orderNum = "";
    if (!order.company) order.company = "";
    if (!order.firstName) order.firstName = "";
    if (!order.lastName) order.lastName = "";
    if (!order.address2) order.address2 = "";
    if (!order.zip) order.zip = "";
    if (!order.shipDate) order.shipDate = "";

    // Generate the payload
    const payload = {
      labelResponseOptions: "LABEL",
      requestedShipment: {
        shipper: config.shipper,
        recipients: [
          {
            contact: {
              personName: `${order.firstName} ${order.lastName}`,
              phoneNumber: order.phone,
              CompanyName: order.company
            },
            address: address
          }
        ],
        shipDatestamp: order.shipDate,
        serviceType: order.serviceType,
        packagingType: order.packagingType,
        pickupType: "USE_SCHEDULED_PICKUP",
        blockInsightVisibility: false,
        shippingChargesPayment: {
          paymentType: "THIRD_PARTY",
          payor: {
            responsibleParty: {
              accountNumber: {
                // value: order.billingAccount // In sandbox mode, use your own account number.
                value: config.shippingAcct
              }
            }
          }
        },
        labelSpecification: {
          imageType: "PDF",
          labelStockType: config.labelStockType
        },
        requestedPackageLineItems: [
          {
            weight: {
              value: order.weight,
              units: "LB"
            },
            dimensions: {
              length: order.len,
              width: order.width,
              height: order.height,
              units: "IN"
            },
            customerReferences: [
              {
                customerReferenceType: "CUSTOMER_REFERENCE",
                value: order.orderNum
              }
            ]
          }
        ]
      },
      accountNumber: {
        value: config.shippingAcct
      }
    };

    // Attempt to generate a shipping label
    const shippedOrder = await createShipment(payload, accessToken);

    // A failed shipped order will return -1 for a tracking number
    if (shippedOrder !== -1) {
      shippedOrders.push({
        billingAccount: order.billingAccount,
        orderNum: order.orderNum,
        company: order.company,
        firstName: order.firstName,
        lastName: order.lastName,
        address1: order.address1,
        address2: order.address2,
        city: order.city,
        state: order.state,
        zip: order.zip,
        phone: order.phone,
        trackingNumber: shippedOrder
      });
    } else {
      failedOrders.push(order.orderNum);
    }
    bar.increment();
  }
  bar.stop();

  // Generate the output CSV of shipped orders
  fs.writeFileSync(
    args.output,
    "billingAccount,orderNum,company,firstName,lastName,address1,address2,city,state,zip,phone,trackingNumber"
  );
  for (order of shippedOrders) {
    fs.appendFileSync(
      args.output,
      `\n${order.billingAccount},${order.orderNum},${order.company},${order.firstName},${order.lastName},${order.address1},${order.address2},${order.city},${order.state},${order.zip},${order.phone},${order.trackingNumber}`
    );
  }

  // Report failed orders if any. If none, print "None"
  const failedOrdersStr = failedOrders.length > 0 ? failedOrders : "None";
  console.log("\nOrders complete, failed orders:\n", failedOrdersStr);
};

/**
 * Attempt to generate a shipping label. If successful, saves the label as
 * labels/${trackingNum}.pdf and returns the tracking number. In the event of a
 * failure, no label is saved, and no tracking number is generated. Print the
 * reason why it failed to console, and return -1.
 *
 * @param {JSON} payload data to send to fedex
 * @param {jwt} accessToken authentication token
 * @returns {string} tracking number for successful shipment, -1 if failed.
 * @async
 */
const createShipment = async (payload, accessToken) => {
  try {
    const res = await axios.post(
      "https://apis-sandbox.fedex.com/ship/v1/shipments",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (res.status === 200) {
      // Tracking number
      const trackingNum =
        res.data.output.transactionShipments[0].pieceResponses[0]
          .trackingNumber;
      // Shipping label encoded as a base64 buffer
      const labelEncoded =
        res.data.output.transactionShipments[0].pieceResponses[0]
          .packageDocuments[0].encodedLabel;
      fs.writeFileSync(
        `labels/${trackingNum}.pdf`,
        Buffer.from(labelEncoded, "base64"),
        err => {
          if (err) console.error;
        }
      );
      return trackingNum;
    }
  } catch (e) {
    if (e.response) {
      console.warn(
        `\nCould not ship ${payload.requestedShipment.requestedPackageLineItems[0].customerReferences[0].value}, reason: ${e.response.data.errors[0].message}`
      );
    } else {
      console.warn(
        `\nCould not ship ${payload.requestedShipment.requestedPackageLineItems[0].customerReferences[0].value}, reason: Could not get response from server`
      );
    }
    return -1;
  }
};

/**
 * Attempt to correct any bad addresses. If a failure occurs, returns the
 * uncorrected incoming address. Expect a failing address to not make a new
 * label, and will require manual intervention.
 *
 * @param {JSON} payload address to validate, formatted to FedEx's preference
 * @param {jwt} accessToken authentication token
 * @returns corrected address if 200, payload otherwise
 * @async
 */
const verifyAddress = async (payload, accessToken) => {
  try {
    const res = await axios.post(
      "https://apis-sandbox.fedex.com/address/v1/addresses/resolve",
      JSON.stringify({
        addressesToValidate: [
          {
            address: payload
          }
        ]
      }),
      {
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (res.status === 200) {
      const {
        streetLinesToken,
        city,
        stateOrProvinceCode,
        postalCode,
        countryCode
      } = res.data.output.resolvedAddresses[0];
      return {
        streetLines: streetLinesToken,
        city,
        stateOrProvinceCode,
        postalCode,
        countryCode
      };
    }
  } catch (e) {
    return payload;
  }
};

/**
 * Authenticate against FedEx's OAuth API. The returning jwt is required in all
 * API calls that use Authentication/Bearer headers.
 *
 * @returns {jwt} authentication token
 * @async
 */
const authenticate = async () => {
  const res = await axios({
    method: "post",
    url: "https://apis-sandbox.fedex.com/oauth/token",
    data: qs.stringify({
      grant_type: "client_credentials",
      client_id: config.apiKey,
      client_secret: config.apiSecret
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" }
  });
  const ret = res.data.access_token;
  return ret;
};

run();
