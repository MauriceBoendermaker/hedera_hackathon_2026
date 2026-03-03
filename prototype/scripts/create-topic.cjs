const { Client, TopicCreateTransaction, PrivateKey, AccountId } = require('@hashgraph/sdk');

// Load .env from prototype root
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function main() {
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;

  if (!operatorId || !operatorKey) {
    console.error('ERROR: Set OPERATOR_ID and OPERATOR_KEY in prototype/.env first');
    console.error('Get these from https://portal.hedera.com');
    process.exit(1);
  }

  const client = Client.forTestnet().setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );

  console.log('Creating HCS topic on Hedera testnet...');

  const txResponse = await new TopicCreateTransaction()
    .setTopicMemo('DURL URL shortener audit log')
    .execute(client);

  const receipt = await txResponse.getReceipt(client);
  const topicId = receipt.topicId.toString();

  console.log('');
  console.log('Topic created successfully!');
  console.log('Topic ID:', topicId);
  console.log('');
  console.log('Add these to prototype/.env:');
  console.log(`HCS_TOPIC_ID=${topicId}`);
  console.log(`REACT_APP_HCS_TOPIC_ID=${topicId}`);

  client.close();
}

main().catch((err) => {
  console.error('Topic creation failed:', err.message);
  process.exit(1);
});
