# PumpFun Token Manager

A versatile tool to check top holders of PumpFun tokens on the Solana blockchain and distribute tokens to them.

## Features

- **Token Holder Analysis**: Find the top holders of any token on Solana
- **Token Distribution**: Automatically distribute 90% of your token balance to the top holders
- **Interactive Menu**: Easy-to-use command-line interface
- **Secure**: Your private key never leaves your computer

## Setup

1. Make sure you have Node.js installed (version 14 or higher recommended)
2. Install dependencies:
   ```
   npm install
   ```

## Usage

1. Run the script:
   ```
   npm start
   ```
2. Select an option from the menu:
   - **Option 1**: Check top 10 token holders
   - **Option 2**: Distribute tokens to top holders
   - **Option 3**: Exit

### Checking Top Holders

When selecting Option 1, you'll need to:
1. Enter the token mint address (contract address) of the token you want to check
2. The script will display the top 10 holders with their balances and percentage holdings

### Distributing Tokens

When selecting Option 2, you'll need to:
1. Enter the token mint address for the token you want to distribute
2. The script will fetch the top 10 holders of that token
3. Enter your wallet's private key (this is secure and only used locally)
4. The script will:
   - Calculate 90% of your token balance
   - Display the amount to be distributed
   - Ask for confirmation before proceeding
   - Distribute the tokens equally among the top 10 holders
   - Display transaction signatures for verification

## Security Notes

- Your private key is only used locally and never transmitted
- Always verify the distribution amounts before confirming
- Consider running on a secure device with no network except for the Solana RPC connection

## Example Distribution

```
=== PumpFun Token Manager ===
1. Check top 10 token holders
2. Distribute tokens to top holders
3. Exit

Select an option (1-3): 2
Enter token address to distribute: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

Fetching top holders first...
Found 20 accounts, getting details for top 10...

💸 PREPARING TOKEN DISTRIBUTION
============================
Sender wallet: DFuRRPpdzgZZCz7MiQEyPxJwu95htYYNZDeUt9xJd9gu
Current balance: 10,000 tokens
Distributing 90% of balance: 9,000 tokens
Amount per recipient: 900 tokens

Continue with distribution? (yes/no): yes

Starting distribution...
Processing recipient 1/10: 4vM9shC2bgRGTTSctMj74y3NZ2uRj7JXXXXXXXXXXXx
Sent 900 tokens to recipient
Transaction signature: 5UbLGUwn7QJ1cv8nVX8UUDyUHQi5YmgzxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA4W7RYkqbz

Processing recipient 2/10: HVmiAF5C2bXpjGY7vxxxxxxxxxxxxxxxxxxxxx
...

✅ Distribution completed!
```

## Dealing with Rate Limits

This script uses multiple public Solana RPC endpoints with automatic failover:
1. api.mainnet-beta.solana.com
2. solana-api.projectserum.com
3. rpc.ankr.com/solana
4. ssc-dao.genesysgo.net

If you encounter persistent rate limit issues:
- Wait a few minutes before trying again
- Consider using a paid/dedicated RPC endpoint service
- You can add your own RPC endpoints by editing the `RPC_ENDPOINTS` array in the script 
