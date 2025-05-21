# PumpFun Token Manager

A comprehensive tool for analyzing token holders on the Solana blockchain and distributing SOL rewards to holders proportionally.

## Features

### Token Holder Analysis
- Analyze ALL token holders (not just top 10 or 100)
- View detailed token distribution statistics
- Get copy-friendly list of holder addresses
- See percentage breakdown of token holdings

### SOL Distribution System
- Distribute SOL to token holders proportionally
- Distribute 90% of your wallet balance (configurable)
- Handle batched transactions for large holder lists
- Filter out dust amounts to avoid failed transactions

### User-Friendly Interface
- Multiple distribution options (all holders, top 100, top 10)
- Fast send options with minimal output
- Quick send to specific addresses with custom percentages
- Detailed progress reporting and confirmation steps

### Automation
- Schedule recurring distributions at custom intervals
- Support for minutes, hours, or days intervals
- Manage multiple active distribution schedulers
- Background operation with persistent scheduling

## Setup

1. Make sure you have Node.js installed (version 14 or higher recommended)
2. Install dependencies:
   ```
   npm install
   ```
3. Add your RPC endpoint in script.js (line 18)

## Usage

1. Run the script:
   ```
   npm start
   ```
2. Select an option from the menu:
   - **Option 1**: Check ALL token holders
   - **Option 2**: Distribute SOL to ALL token holders
   - **Option 3**: Quick send SOL to specific addresses
   - **Option 4**: Fast send SOL to ALL holders
   - **Option 5**: Fast send SOL to top 100 holders only
   - **Option 6**: Fast send SOL to top 10 holders only
   - **Option 7**: Schedule automatic distributions
   - **Option 8**: Exit

## How it Works

The script connects to the Solana blockchain and performs the following actions:

1. **Token Analysis**: Fetches token holder data using Solana Web3.js APIs
2. **Distribution Calculation**: Calculates each holder's share based on their token holdings
3. **Transaction Batching**: Groups recipients into batches to avoid transaction size limits
4. **SOL Transfer**: Sends SOL to token holders in proportion to their holdings

## Security Notes

- Your private key is only used locally and never transmitted
- Always verify the distribution amounts before confirming
- Consider running on a secure device with no network except for the Solana RPC connection

## RPC Endpoints

The script is configured to use a premium RPC endpoint. You should replace it with your own:

```javascript
const RPC_ENDPOINTS = [
  'YOUR_RPC_ENDPOINT_HERE'
];
```

You can sign up for premium endpoints at:
- QuickNode
- Alchemy
- Helius
- GenesysGo

## Example Advanced Distribution

```
=== PumpFun Token Manager ===
4. Fast send SOL to ALL holders

⚡ FAST SEND TO ALL HOLDERS
============================
Enter token address to find holders: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
Enter your wallet private key to send SOL from: ****************************************
Sender wallet: DFuRRPpdzgZZCz7MiQEyPxJwu95htYYNZDeUt9xJd9gu
Finding all holders (minimized output)...
Found 532 holders. Preparing distribution...

💸 PREPARING SOL DISTRIBUTION TO 532 HOLDERS
Distribution will be sent in 27 batches of up to 20 recipients each
==================================================================
Sender wallet: DFuRRPpdzgZZCz7MiQEyPxJwu95htYYNZDeUt9xJd9gu
Current SOL balance: 10.500000 SOL

Distributing 90% of balance: 9.270000 SOL
Distribution by token holding percentage (showing top 20):
1. 4vM9shC2bgR... - 5.235921% - 0.485170 SOL
2. HVmiAF5C2bX... - 4.872154% - 0.451650 SOL
...
... and 512 more recipients
Reserved for fees: 0.270000 SOL

Processing 27 batches...

Processing batch 1/27 with 20 recipients...
Sending transaction for batch 1 with 20 transfers...
✅ Batch 1 successful!
Transaction signature: 5UbLGUwn7QJ1cv8nVX8UUDyUHQi5YmgzxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA4W7RYkqbz

... (additional batches) ...

🔄 Distribution summary:
• 27 successful batch transactions
• 0 failed batch transactions
• 532 total recipients received SOL

✅ Distribution completed!
```

## Scheduling Distributions

You can set up automatic distributions on a schedule:

1. Select Option 7 from the main menu
2. Configure distribution parameters:
   - Token address
   - Maximum number of holders
   - Time interval (minutes, hours, days)
   - Percentage of balance to distribute

Active schedulers will continue running in the background, allowing you to manage them or add new scheduled distributions 