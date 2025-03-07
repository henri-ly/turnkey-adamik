import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import { broadcastTransaction } from "./adamik/broadcastTransaction";
import { encodePubKeyToAddress } from "./adamik/encodePubkeyToAddress";
import { encodeTransaction } from "./adamik/encodeTransaction";
import { getAccountState } from "./adamik/getAccountState";
import { adamikGetChains } from "./adamik/getChains";
import { signerSelector } from "./signers";
import {
  amountToMainUnit,
  errorTerminal,
  infoTerminal,
  italicInfoTerminal,
} from "./utils";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  infoTerminal("========================================");

  infoTerminal("Getting chains ...", "Adamik");
  const { chains, chainId, signerSpec } = await adamikGetChains();

  infoTerminal(`Selected chain: ${chainId}`, "Adamik");
  infoTerminal(`- Name: ${chains[chainId].name}`, "Adamik");
  infoTerminal(`- Ticker: ${chains[chainId].ticker}`, "Adamik");
  infoTerminal(`- Decimals: ${chains[chainId].decimals}`, "Adamik");

  infoTerminal("\n========================================");

  const signer = await signerSelector(chainId, signerSpec);

  infoTerminal("========================================");

  infoTerminal(`Getting pubkey ...`, signer.signerName);
  const pubkey = await signer.getPubkey();
  infoTerminal(`Pubkey:`, signer.signerName);
  italicInfoTerminal(JSON.stringify(pubkey, null, 2));

  if (!pubkey) {
    errorTerminal("Failed to get pubkey from signer", signer.signerName);
    return;
  }

  infoTerminal("========================================");

  infoTerminal(`Encoding pubkey to address ...`, "Adamik");
  const address = await encodePubKeyToAddress(pubkey, chainId);
  infoTerminal(`Address:`, "Adamik");
  italicInfoTerminal(address);

  infoTerminal("========================================");

  infoTerminal(`Fetching balance ...`, "Adamik");
  const balance = await getAccountState(chainId, address);
  infoTerminal(`Balance:`, "Adamik");
  italicInfoTerminal(
    `\t- ${amountToMainUnit(
      balance.balances.native.total,
      chains[chainId].decimals
    )} ${chains[chainId].ticker} - ${chains[chainId].name}`
  );
  balance.balances.tokens.forEach((token) => {
    italicInfoTerminal(
      `${amountToMainUnit(token.amount, token.token.decimals)} ${
        token.token.ticker
      } - ${token.token.name}`
    );
  });

  infoTerminal("========================================");

  infoTerminal(`We will now encode a transaction simulating a transfer ...`);

  const { continueTransaction } = await prompts({
    type: "confirm",
    name: "continueTransaction",
    message: "Do you want to continue ?",
    initial: true,
  });

  if (!continueTransaction) {
    infoTerminal("Transaction not encoded.");
    return;
  }

  const transactionEncodeResponse = await encodeTransaction({
    chainId,
    senderAddress: address,
    decimals: chains[chainId].decimals,
    ticker: chains[chainId].ticker,
    balance,
    pubkey,
  });

  infoTerminal("Transaction encoded:", "Adamik");
  infoTerminal(`- Chain ID: ${transactionEncodeResponse.chainId}`, "Adamik");
  infoTerminal(`- Transaction data:`, "Adamik");
  italicInfoTerminal(
    JSON.stringify(transactionEncodeResponse.transaction.data, null, 2)
  );
  infoTerminal(`- Message to sign :`, "Adamik");
  italicInfoTerminal(transactionEncodeResponse.transaction.encoded);

  infoTerminal("========================================");

  infoTerminal(`We will now sign the transaction ...`);

  infoTerminal(`- Signer spec:\n`, "Adamik");
  italicInfoTerminal(JSON.stringify(signerSpec, null, 2));

  const { continueSigning } = await prompts({
    type: "confirm",
    name: "continueSigning",
    message: "Do you want to continue ?",
    initial: true,
  });

  if (!continueSigning) {
    infoTerminal("Abort signature.");
    return;
  }

  const signature = await signer.signTransaction(
    transactionEncodeResponse.transaction.encoded
  );

  infoTerminal(`Signature length: ${signature.length}`, signer.signerName);
  infoTerminal(`Signature:`, signer.signerName);
  italicInfoTerminal(signature);
  infoTerminal("========================================");

  infoTerminal(`Please check the payload that will be broadcasted.`);
  infoTerminal(`Transaction data:`, "Adamik");
  italicInfoTerminal(
    JSON.stringify(
      {
        ...transactionEncodeResponse,
        signature: signature,
      },
      null,
      2
    )
  );

  const broadcastResponse = await broadcastTransaction(
    chainId,
    transactionEncodeResponse,
    signature
  );

  infoTerminal("Transaction broadcasted:", "Adamik");
  italicInfoTerminal(JSON.stringify(broadcastResponse, null, 2));
  infoTerminal("========================================");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
