import {
  Client,
  TopicMessageSubmitTransaction,
  TopicId,
  PrivateKey,
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";
dotenv.config();

let client: Client;

function getClient(): Client {
  if (!client) {
    client = Client.forName(process.env.HEDERA_NETWORK!);
    client.setOperator(
      process.env.OPERATOR_ID!,
      PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY!)
    );
  }
  return client;
}

export interface LinkCreatedEvent {
  slug: string;
  originalUrl: string;
  creator: string;
  type: "random" | "custom";
  txHash: string;
  timestamp: number;
}

export async function logLinkCreated(event: LinkCreatedEvent): Promise<void> {
  const topicId = TopicId.fromString(process.env.TOPIC_ID!);
  const message = JSON.stringify(event);

  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message)
    .execute(getClient());

  const receipt = await tx.getReceipt(getClient());
  console.log(`HCS message submitted, sequence: ${receipt.topicSequenceNumber}`);
}