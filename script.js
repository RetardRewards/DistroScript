// Script to fetch top 10 holders of a PumpFun token and distribute SOL
const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  getAccount
} = require('@solana/spl-token');
const bs58 = require('bs58');
const readline = require('readline');

// Using premium QuickNode endpoint for better rate limits
const RPC_ENDPOINTS = [
  'https://magical-boldest-patina.solana-mainnet.quiknode.pro/a94255dcbb27e52b1d4cca35d10e899b82b6bdba/'
];

let currentEndpointIndex = 0;
let connection = new Connection(RPC_ENDPOINTS[currentEndpointIndex], {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000
});

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to get token holders
async function getTokenHolders(tokenMintAddress, quietMode = false, limitResults = false, maxHolders = 100) {
  try {
    const mintPubkey = new PublicKey(tokenMintAddress);
    if (!quietMode) console.log(`\nFetching all holders for: ${tokenMintAddress}`);
    
    // Get token accounts
    if (!quietMode) console.log(`Fetching token accounts...`);
    
    // Use getProgramAccounts to get all accounts and then sort them
    const allTokenAccounts = await connection.getParsedProgramAccounts(
      TOKEN_PROGRAM_ID,
      {
        filters: [
          {
            dataSize: 165, // Size of a token account
          },
          {
            memcmp: {
              offset: 0, // Mint address location in token accounts
              bytes: mintPubkey.toBase58(),
            },
          },
        ],
      }
    );
    
    if (!allTokenAccounts || allTokenAccounts.length === 0) {
      console.log('No token accounts found for this mint address.');
      return [];
    }
    
    // Parse and format account data
    const parsedAccounts = [];
    let totalProcessed = 0;
    let totalNonZeroAccounts = 0;
    
    for (const account of allTokenAccounts) {
      try {
        totalProcessed++;
        if (!quietMode && totalProcessed % 100 === 0) {
          process.stdout.write(`\rProcessing accounts: ${totalProcessed}/${allTokenAccounts.length}`);
        }
        
        if (account.account.data.parsed && 
            account.account.data.parsed.info && 
            account.account.data.parsed.info.tokenAmount) {
          
          const parsedInfo = account.account.data.parsed.info;
          const owner = parsedInfo.owner;
          const decimals = parsedInfo.tokenAmount.decimals || 0;
          const rawAmount = parsedInfo.tokenAmount.amount;
          const amount = Number(rawAmount) / Math.pow(10, decimals);
          
          if (amount > 0) { // Only include non-zero balances
            totalNonZeroAccounts++;
            parsedAccounts.push({
              owner,
              amount,
              decimals,
              address: account.pubkey.toBase58()
            });
          }
        }
      } catch (err) {
        if (!quietMode) console.log(`\nError parsing account: ${err.message}`);
      }
    }
    
    if (!quietMode) console.log(`\nProcessed ${totalProcessed} accounts, found ${totalNonZeroAccounts} with non-zero balances.`);
    
    // Sort by amount descending
    parsedAccounts.sort((a, b) => b.amount - a.amount);
    
    // Limit results if requested (for display purposes)
    const holderAccounts = limitResults ? parsedAccounts.slice(0, maxHolders) : parsedAccounts;
    
    if (holderAccounts.length === 0) {
      console.log('Could not retrieve any holder information.');
      return [];
    }
    
    // Calculate total token supply from all accounts
    const totalTokens = parsedAccounts.reduce((sum, acc) => sum + acc.amount, 0);
    
    // Display results
    console.log(`\n🔍 ALL TOKEN HOLDERS (${holderAccounts.length}):`);
    console.log('===========================');
    
    // Only show top 20 in detail to avoid cluttering the terminal
    const displayCount = Math.min(20, holderAccounts.length);
    
    holderAccounts.slice(0, displayCount).forEach((account, index) => {
      const percentage = (account.amount / totalTokens) * 100;
      console.log(`${index + 1}. ${account.owner}`);
      console.log(`   Balance: ${account.amount.toLocaleString()} tokens (${percentage.toFixed(6)}%)\n`);
    });
    
    if (holderAccounts.length > displayCount) {
      console.log(`... and ${holderAccounts.length - displayCount} more holders (not shown in detail)`);
    }
    
    // Display summary stats of token distribution
    const topTenPercent = parsedAccounts.slice(0, Math.max(1, Math.ceil(parsedAccounts.length * 0.1)))
      .reduce((sum, acc) => sum + acc.amount, 0) / totalTokens * 100;
      
    console.log(`\n📊 TOKEN DISTRIBUTION STATS:`);
    console.log(`• Total holders: ${parsedAccounts.length}`);
    console.log(`• Total token supply: ${totalTokens.toLocaleString()}`);
    console.log(`• Top 10% of holders control: ${topTenPercent.toFixed(2)}% of supply`);
    
    // Display all addresses in one list for easy copying
    console.log('\n📋 ALL HOLDER ADDRESSES (for easy copying):');
    console.log('============================================');
    
    // Limit copy list to avoid overwhelming terminal
    const copyLimit = Math.min(500, holderAccounts.length);
    holderAccounts.slice(0, copyLimit).forEach((account) => {
      console.log(`${account.owner}`);
    });
    
    if (holderAccounts.length > copyLimit) {
      console.log(`... and ${holderAccounts.length - copyLimit} more (not shown)`);
    }
    
    return holderAccounts;
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('Invalid public key input')) {
      console.log('Please check the token address and make sure it is a valid Solana address.');
    }
    return [];
  }
}

// Store for active schedulers
const activeSchedulers = new Map();

// Function to schedule automatic distributions at regular intervals
async function scheduleAutomaticDistributions() {
  console.log('\n⏱️ SCHEDULE AUTOMATIC DISTRIBUTIONS');
  console.log('===================================');
  
  // Get token address and configuration
  const tokenAddress = await askQuestion('Enter token address to find holders: ');
  const holderLimitStr = await askQuestion('Enter maximum number of holders to distribute to (0 for all): ');
  const holderLimit = parseInt(holderLimitStr) || 0;
  
  const privateKey = await askQuestion('Enter your wallet private key to send SOL from: ');
  
  // Validate private key
  let keyPair;
  try {
    keyPair = Keypair.fromSecretKey(bs58.decode(privateKey.trim()));
    const walletAddress = keyPair.publicKey.toString();
    console.log(`Sender wallet: ${walletAddress}`);
    
    // Check initial balance
    const balance = await connection.getBalance(keyPair.publicKey);
    console.log(`Current SOL balance: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    
    if (balance <= 0) {
      console.error('Error: Wallet has no SOL. Please fund the wallet before scheduling distributions.');
      showMainMenu();
      return;
    }
  } catch (error) {
    console.error('Invalid private key format. Please check your private key.');
    showMainMenu();
    return;
  }
  
  // Get time interval
  const intervalType = await askQuestion('Select interval type (minutes, hours, days): ');
  const intervalValueStr = await askQuestion(`Enter number of ${intervalType}: `);
  const intervalValue = parseInt(intervalValueStr);
  
  if (isNaN(intervalValue) || intervalValue <= 0) {
    console.error('Invalid interval value. Please enter a positive number.');
    showMainMenu();
    return;
  }
  
  // Calculate interval in milliseconds
  let intervalMs = 0;
  switch (intervalType.toLowerCase()) {
    case 'minutes':
      intervalMs = intervalValue * 60 * 1000;
      break;
    case 'hours':
      intervalMs = intervalValue * 60 * 60 * 1000;
      break;
    case 'days':
      intervalMs = intervalValue * 24 * 60 * 60 * 1000;
      break;
    default:
      console.error('Invalid interval type. Please select minutes, hours, or days.');
      showMainMenu();
      return;
  }
  
  // Get distribution percentage
  const percentageStr = await askQuestion('Enter percentage of SOL balance to distribute each time (1-100): ');
  const percentage = parseFloat(percentageStr);
  
  if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
    console.error('Invalid percentage. Must be between 1 and 100.');
    showMainMenu();
    return;
  }
  
  // Set a unique ID for this scheduler
  const schedulerId = Date.now().toString();
  
  // Create a flag to track if the scheduler should continue
  const schedulerState = {
    active: true,
    id: schedulerId,
    tokenAddress,
    holderLimit,
    intervalMs,
    intervalDescription: `${intervalValue} ${intervalType}`,
    percentage,
    privateKey,
    nextRun: new Date(Date.now() + intervalMs),
    runsCompleted: 0
  };
  
  // Store the scheduler state
  activeSchedulers.set(schedulerId, schedulerState);
  
  // Verify token exists and holders can be found
  console.log(`\nVerifying token and holders...`);
  try {
    const holders = await getTokenHolders(
      tokenAddress.trim(), 
      true,                    // quiet mode
      holderLimit > 0,         // limit results?
      holderLimit              // max holders if limiting
    );
    
    if (holders.length === 0) {
      console.error('Could not find any token holders. Scheduler canceled.');
      activeSchedulers.delete(schedulerId);
      showMainMenu();
      return;
    }
    
    console.log(`Found ${holders.length} holders for scheduled distributions.`);
  } catch (error) {
    console.error(`Error verifying token holders: ${error.message}`);
    activeSchedulers.delete(schedulerId);
    showMainMenu();
    return;
  }
  
  const limitText = holderLimit > 0 ? `TOP ${holderLimit}` : "ALL";
  
  console.log(`\n✅ Scheduler configured successfully!`);
  console.log(`• Distribution will run every ${intervalValue} ${intervalType}`);
  console.log(`• Will distribute to ${limitText} holders of token ${tokenAddress}`);
  console.log(`• Each distribution will use ${percentage}% of available balance`);
  console.log(`• First distribution will run at: ${schedulerState.nextRun.toLocaleString()}`);
  console.log(`• Scheduler ID: ${schedulerId}`);
  
  // Start the distribution scheduler
  runScheduler(schedulerState);
  
  // Show management menu
  await manageSchedulers();
}

// Function to execute the scheduled distribution
async function runScheduler(schedulerState) {
  if (!schedulerState.active) return;
  
  // Calculate time until next run
  const now = Date.now();
  const timeUntilNextRun = Math.max(0, schedulerState.nextRun.getTime() - now);
  
  // Schedule the next run
  setTimeout(async () => {
    if (!schedulerState.active) return;
    
    console.log(`\n⏰ RUNNING SCHEDULED DISTRIBUTION (ID: ${schedulerState.id})`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`Run #${schedulerState.runsCompleted + 1}`);
    
    try {
      // Get the holders for this distribution
      const holders = await getTokenHolders(
        schedulerState.tokenAddress, 
        true,                             // quiet mode
        schedulerState.holderLimit > 0,   // limit results?
        schedulerState.holderLimit        // max holders if limiting
      );
      
      if (holders.length === 0) {
        console.error('Could not find any token holders for this distribution.');
      } else {
        console.log(`Found ${holders.length} holders for distribution.`);
        
        // Create a temporary keypair for this distribution
        const keyPair = Keypair.fromSecretKey(bs58.decode(schedulerState.privateKey));
        const walletAddress = keyPair.publicKey.toString();
        
        // Check current balance
        const balance = await connection.getBalance(keyPair.publicKey);
        console.log(`Current SOL balance: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        
        if (balance <= 0) {
          console.error('Wallet has no SOL. Skipping this distribution.');
        } else {
          // Override distribution percentage for scheduled runs
          const originalPercentage = customDistributionPercentage;
          customDistributionPercentage = schedulerState.percentage;
          
          // Run the distribution
          await distributeSol(schedulerState.privateKey, holders);
          
          // Reset the distribution percentage
          customDistributionPercentage = originalPercentage;
          
          // Increment run counter
          schedulerState.runsCompleted++;
        }
      }
    } catch (error) {
      console.error(`Error in scheduled distribution: ${error.message}`);
    }
    
    // Schedule next run
    schedulerState.nextRun = new Date(Date.now() + schedulerState.intervalMs);
    console.log(`Next scheduled run: ${schedulerState.nextRun.toLocaleString()}`);
    
    // Continue the scheduler
    runScheduler(schedulerState);
    
  }, timeUntilNextRun);
}

// Variable to store custom distribution percentage
let customDistributionPercentage = 90; // Default is 90%

// Function to manage active schedulers
async function manageSchedulers() {
  console.log('\n=== Scheduler Management ===');
  console.log(`Active Schedulers: ${activeSchedulers.size}`);
  
  if (activeSchedulers.size === 0) {
    console.log('No active schedulers.');
    showMainMenu();
    return;
  }
  
  // Display all active schedulers
  console.log('\nCurrent active schedulers:');
  let index = 1;
  for (const [id, state] of activeSchedulers.entries()) {
    const limitText = state.holderLimit > 0 ? `TOP ${state.holderLimit}` : "ALL";
    console.log(`${index}. ID: ${id.substring(0, 8)}...`);
    console.log(`   Token: ${state.tokenAddress.substring(0, 12)}...`);
    console.log(`   Distribution: ${state.percentage}% to ${limitText} holders`);
    console.log(`   Interval: every ${state.intervalDescription}`);
    console.log(`   Next run: ${state.nextRun.toLocaleString()}`);
    console.log(`   Runs completed: ${state.runsCompleted}`);
    console.log(`   Status: ${state.active ? 'Active' : 'Paused'}`);
    console.log();
    index++;
  }
  
  console.log('Management Options:');
  console.log('1. Stop a scheduler');
  console.log('2. Stop all schedulers');
  console.log('3. Return to main menu (schedulers will continue in background)');
  
  const choice = await askQuestion('\nSelect an option (1-3): ');
  
  switch (choice) {
    case '1':
      const idToStop = await askQuestion('Enter the ID of the scheduler to stop: ');
      if (activeSchedulers.has(idToStop)) {
        const state = activeSchedulers.get(idToStop);
        state.active = false;
        activeSchedulers.delete(idToStop);
        console.log(`Scheduler ${idToStop} has been stopped.`);
      } else {
        console.log('Scheduler ID not found. Check the ID and try again.');
      }
      await manageSchedulers();
      break;
      
    case '2':
      const confirm = await askQuestion('Are you sure you want to stop all schedulers? (yes/no): ');
      if (confirm.toLowerCase() === 'yes') {
        for (const [id, state] of activeSchedulers.entries()) {
          state.active = false;
        }
        activeSchedulers.clear();
        console.log('All schedulers have been stopped.');
      }
      showMainMenu();
      break;
      
    case '3':
      console.log('Returning to main menu. Schedulers will continue running in the background.');
      showMainMenu();
      break;
      
    default:
      console.log('Invalid option. Please try again.');
      await manageSchedulers();
  }
}

// Function to distribute SOL to token holders
async function distributeSol(privateKey, recipients) {
  try {
    if (!privateKey) {
      console.log('Private key is required');
      return;
    }
    
    if (!recipients || recipients.length === 0) {
      console.log('No recipients provided for distribution');
      return;
    }
    
    // Handle large recipient lists by adding batching
    const MAX_RECIPIENTS_PER_TX = 20; // Solana has a limit on instructions per transaction
    const batches = [];
    
    // Split recipients into batches
    for (let i = 0; i < recipients.length; i += MAX_RECIPIENTS_PER_TX) {
      batches.push(recipients.slice(i, i + MAX_RECIPIENTS_PER_TX));
    }
    
    console.log(`\n💸 PREPARING SOL DISTRIBUTION TO ${recipients.length} HOLDERS`);
    console.log(`Distribution will be sent in ${batches.length} batches of up to ${MAX_RECIPIENTS_PER_TX} recipients each`);
    console.log('==================================================================');
    
    // Convert privateKey to Keypair
    let keyPair;
    try {
      keyPair = Keypair.fromSecretKey(bs58.decode(privateKey));
      const walletAddress = keyPair.publicKey.toString();
      console.log(`Sender wallet: ${walletAddress}`);
    } catch (error) {
      console.error('Invalid private key format. Please check your private key.');
      return;
    }
    
    // Check SOL balance
    try {
      const balance = await connection.getBalance(keyPair.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      console.log(`Current SOL balance: ${solBalance.toFixed(6)} SOL`);
      
      if (balance <= 0) {
        console.error('No SOL to distribute. Your balance is 0.');
        return;
      }
      
      // Account for transaction fees - Solana transactions cost approximately 0.000005 SOL per signature
      // Reserve 0.01 SOL for fees to be safe with multiple transactions
      const minSolForFees = 0.01 * LAMPORTS_PER_SOL * batches.length;
      
      // Use either default percentage (90%) or custom percentage from scheduler
      const distributionPercentage = customDistributionPercentage || 90;
      
      // Calculate distribution amount (X% of balance minus fees)
      const availableBalance = Math.max(0, balance - minSolForFees);
      const distributionAmount = availableBalance * (distributionPercentage / 100);
      
      // Check if there's enough to distribute
      if (distributionAmount <= 0) {
        console.error('Not enough SOL to distribute after reserving for fees.');
        return;
      }
      
      const solToDistribute = distributionAmount / LAMPORTS_PER_SOL;
      
      // Calculate the total token amount of all recipients
      const totalTokens = recipients.reduce((sum, acc) => sum + acc.amount, 0);
      
      // Calculate each recipient's percentage and SOL amount based on their token holdings
      recipients.forEach(recipient => {
        recipient.percentage = (recipient.amount / totalTokens) * 100;
        recipient.solAmount = (recipient.percentage / 100) * solToDistribute;
        recipient.lamports = Math.floor(recipient.solAmount * LAMPORTS_PER_SOL);
      });
      
      console.log(`\nDistributing ${distributionPercentage}% of balance: ${solToDistribute.toFixed(6)} SOL`);
      
      // Show top 20 recipients by amount
      const topRecipients = [...recipients].sort((a, b) => b.solAmount - a.solAmount).slice(0, 20);
      
      console.log(`Distribution by token holding percentage (showing top 20):`);
      topRecipients.forEach((recipient, index) => {
        console.log(`${index + 1}. ${recipient.owner.substring(0, 12)}... - ${recipient.percentage.toFixed(6)}% - ${recipient.solAmount.toFixed(6)} SOL`);
      });
      
      if (recipients.length > 20) {
        console.log(`... and ${recipients.length - 20} more recipients`);
      }
      
      console.log(`Reserved for fees: ${(minSolForFees / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      
      // Confirm with user if not running from a scheduler
      let shouldProceed = true;
      if (!activeSchedulers.size) { // Only ask for confirmation if not running from scheduler
        const confirmDistribution = await askQuestion('\nContinue with distribution? (yes/no): ');
        shouldProceed = confirmDistribution.toLowerCase() === 'yes';
      }
      
      if (!shouldProceed) {
        console.log('Distribution cancelled');
        return;
      }
      
      // Process each batch separately
      console.log(`\nProcessing ${batches.length} batches...`);
      
      let successfulTxs = 0;
      let failedTxs = 0;
      let totalRecipientsSent = 0;
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`\nProcessing batch ${batchIndex + 1}/${batches.length} with ${batch.length} recipients...`);
        
        try {
          // Create a transaction for this batch
          const transaction = new Transaction();
          
          // Add transfer instructions for each recipient in this batch
          let batchRecipientsAdded = 0;
          
          for (const recipient of batch) {
            try {
              const recipientAddress = new PublicKey(recipient.owner);
              
              // Only add if amount is meaningful (avoid dust)
              if (recipient.lamports > 1000) { // More than 0.000001 SOL
                transaction.add(
                  SystemProgram.transfer({
                    fromPubkey: keyPair.publicKey,
                    toPubkey: recipientAddress,
                    lamports: recipient.lamports,
                  })
                );
                
                batchRecipientsAdded++;
              }
            } catch (error) {
              console.error(`Error adding recipient ${recipient.owner}: ${error.message}`);
            }
          }
          
          if (batchRecipientsAdded === 0) {
            console.log(`No valid recipients in batch ${batchIndex + 1}, skipping...`);
            continue;
          }
          
          console.log(`Sending transaction for batch ${batchIndex + 1} with ${batchRecipientsAdded} transfers...`);
          
          // Send and confirm the transaction
          const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [keyPair],
            { commitment: 'confirmed' }
          );
          
          console.log(`✅ Batch ${batchIndex + 1} successful!`);
          console.log(`Transaction signature: ${signature}`);
          
          totalRecipientsSent += batchRecipientsAdded;
          successfulTxs++;
          
          // Wait briefly between batches to avoid rate limits
          if (batchIndex < batches.length - 1) {
            console.log('Waiting before next batch...');
            await sleep(2000);
          }
          
        } catch (error) {
          console.error(`Error processing batch ${batchIndex + 1}: ${error.message}`);
          failedTxs++;
          
          // Wait a bit longer after an error
          if (batchIndex < batches.length - 1) {
            console.log('Waiting before next batch...');
            await sleep(5000);
          }
        }
      }
      
      console.log(`\n🔄 Distribution summary:`);
      console.log(`• ${successfulTxs} successful batch transactions`);
      console.log(`• ${failedTxs} failed batch transactions`);
      console.log(`• ${totalRecipientsSent} total recipients received SOL`);
      
      if (successfulTxs > 0) {
        console.log('\n✅ Distribution completed!');
      } else {
        console.log('\n❌ Distribution failed.');
      }
      
    } catch (error) {
      console.error('Error checking SOL balance:', error.message);
    }
    
  } catch (error) {
    console.error('Error during distribution:', error.message);
  }
}

// Setup readline for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function for prompts
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Main menu function
async function showMainMenu() {
  console.log('\n=== PumpFun Token Manager ===');
  console.log('1. Check ALL token holders');
  console.log('2. Distribute SOL to ALL token holders');
  console.log('3. Quick send SOL to specific addresses');
  console.log('4. Fast send SOL to ALL holders');
  console.log('5. Fast send SOL to top 100 holders only');
  console.log('6. Fast send SOL to top 10 holders only');
  console.log('7. Schedule automatic distributions');
  console.log('8. Exit');
  
  const choice = await askQuestion('\nSelect an option (1-8): ');
  
  switch (choice) {
    case '1':
      const tokenAddress = await askQuestion('Enter token address: ');
      await getTokenHolders(tokenAddress.trim(), false, false); // All holders, not quiet, no limit
      showMainMenu();
      break;
      
    case '2':
      const distributionToken = await askQuestion('Enter token address to find holders: ');
      const confirmAll = await askQuestion('This will fetch ALL token holders which could be hundreds or thousands. Continue? (yes/no): ');
      
      if (confirmAll.toLowerCase() === 'yes') {
        console.log('\nFetching all token holders...');
        const holders = await getTokenHolders(distributionToken.trim(), false, false); // All holders
        
        if (holders.length > 0) {
          if (holders.length > 100) {
            console.log(`\nWARNING: You are about to distribute SOL to ${holders.length} addresses.`);
            console.log('Large transactions may fail or require multiple separate transactions.');
            const confirmLarge = await askQuestion('Continue with distribution to all holders? (yes/no): ');
            if (confirmLarge.toLowerCase() !== 'yes') {
              console.log('Distribution cancelled.');
              showMainMenu();
              return;
            }
          }
          
          const privateKey = await askQuestion('\nEnter your wallet private key to send SOL from: ');
          await distributeSol(privateKey.trim(), holders);
        }
      } else {
        console.log('Operation cancelled.');
      }
      
      showMainMenu();
      break;
      
    case '3':
      await quickSendSol();
      showMainMenu();
      break;
      
    case '4':
      await fastSendToHolders(0); // 0 means all holders
      showMainMenu();
      break;
      
    case '5':
      await fastSendToHolders(100);
      showMainMenu();
      break;
      
    case '6':
      await fastSendToHolders(10);
      showMainMenu();
      break;
      
    case '7':
      await scheduleAutomaticDistributions();
      // No showMainMenu() here as the scheduler will keep running
      break;
      
    case '8':
      console.log('Exiting program. Goodbye!');
      rl.close();
      break;
      
    default:
      console.log('Invalid option. Please try again.');
      showMainMenu();
  }
}

// Function to quickly send SOL to holders with minimal output
async function fastSendToHolders(holderLimit = 0) {
  const limitText = holderLimit > 0 ? `TOP ${holderLimit}` : "ALL";
  console.log(`\n⚡ FAST SEND TO ${limitText} HOLDERS`);
  console.log('=' + '='.repeat(limitText.length) + '====================');
  
  // Get token address and private key in one go
  const tokenAddress = await askQuestion('Enter token address to find holders: ');
  const privateKey = await askQuestion('Enter your wallet private key to send SOL from: ');
  
  // Create keypair first to validate the private key early
  let keyPair;
  try {
    keyPair = Keypair.fromSecretKey(bs58.decode(privateKey.trim()));
    const walletAddress = keyPair.publicKey.toString();
    console.log(`Sender wallet: ${walletAddress}`);
  } catch (error) {
    console.error('Invalid private key format. Please check your private key.');
    return;
  }
  
  console.log(`Finding ${limitText.toLowerCase()} holders (minimized output)...`);
  
  // Get holders with quietMode=true, and limit if holderLimit > 0
  const holders = await getTokenHolders(
    tokenAddress.trim(), 
    true,                  // quiet mode
    holderLimit > 0,       // limit results?
    holderLimit            // max holders if limiting
  );
  
  if (holders.length === 0) {
    console.log('Could not find any token holders. Operation cancelled.');
    return;
  }
  
  if (holders.length > 100) {
    console.log(`\nWARNING: You are about to distribute SOL to ${holders.length} addresses.`);
    console.log('Large transactions may fail or require multiple separate transactions.');
    const confirmLarge = await askQuestion('Continue with distribution to all holders? (yes/no): ');
    if (confirmLarge.toLowerCase() !== 'yes') {
      console.log('Distribution cancelled.');
      return;
    }
  }
  
  console.log(`Found ${holders.length} holders. Preparing distribution...`);
  
  // Send the distribution - will distribute proportionally
  await distributeSol(privateKey.trim(), holders);
}

// Function to quickly send SOL to specific addresses
async function quickSendSol() {
  console.log('\n💸 QUICK SEND SOL');
  console.log('===============');
  
  // Get wallet private key
  const privateKey = await askQuestion('Enter your wallet private key to send SOL from: ');
  
  let keyPair;
  try {
    keyPair = Keypair.fromSecretKey(bs58.decode(privateKey.trim()));
    const walletAddress = keyPair.publicKey.toString();
    console.log(`Sender wallet: ${walletAddress}`);
  } catch (error) {
    console.error('Invalid private key format. Please check your private key.');
    return;
  }
  
  // Check SOL balance
  try {
    const balance = await connection.getBalance(keyPair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    console.log(`Current SOL balance: ${solBalance.toFixed(6)} SOL`);
    
    if (balance <= 0) {
      console.error('No SOL to distribute. Your balance is 0.');
      return;
    }
    
    // Get recipient addresses
    console.log('\nEnter recipient addresses (one per line). Type "done" when finished:');
    const recipients = [];
    
    while (true) {
      const address = await askQuestion('Address (or "done"): ');
      
      if (address.toLowerCase() === 'done') {
        break;
      }
      
      try {
        // Validate the address
        new PublicKey(address.trim());
        
        // Ask for percentage for this address
        const percentStr = await askQuestion(`Percentage for ${address.trim()} (1-100): `);
        const percentage = parseFloat(percentStr);
        
        if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
          console.error('Invalid percentage. Must be between 1 and 100. Skipping this address.');
          continue;
        }
        
        recipients.push({ 
          owner: address.trim(), 
          percentage: percentage,
          amount: percentage // Using amount to store percentage for compatibility
        });
        
        console.log(`Added recipient: ${address.trim()} with ${percentage}%`);
      } catch (error) {
        console.error('Invalid address format. Please try again.');
      }
    }
    
    if (recipients.length === 0) {
      console.log('No valid recipients added. Operation cancelled.');
      return;
    }
    
    // Check that percentages add up to 100
    const totalPercentage = recipients.reduce((sum, rec) => sum + rec.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) { // Allow small rounding error
      console.log(`Warning: Percentages total ${totalPercentage}%, not 100%. Normalizing...`);
      
      // Normalize percentages to add up to 100
      recipients.forEach(rec => {
        rec.percentage = (rec.percentage / totalPercentage) * 100;
      });
    }
    
    console.log(`\nAdded ${recipients.length} recipients with normalized percentages:`);
    recipients.forEach((rec, i) => {
      console.log(`${i+1}. ${rec.owner} - ${rec.percentage.toFixed(2)}%`);
    });
    
    // Account for transaction fees
    const minSolForFees = 0.001 * LAMPORTS_PER_SOL;
    
    // Calculate distribution amount based on percentage
    const availableBalance = Math.max(0, balance - minSolForFees);
    const distributionAmount = availableBalance * 0.9;
    
    // Check if there's enough to distribute
    if (distributionAmount <= 0) {
      console.error('Not enough SOL to distribute after reserving for fees.');
      return;
    }
    
    const solToDistribute = distributionAmount / LAMPORTS_PER_SOL;
    
    // Calculate SOL amount for each recipient based on their percentage
    recipients.forEach(recipient => {
      recipient.solAmount = (recipient.percentage / 100) * solToDistribute;
      recipient.lamports = Math.floor(recipient.solAmount * LAMPORTS_PER_SOL);
    });
    
    console.log(`\nDistributing 90% of balance: ${solToDistribute.toFixed(6)} SOL`);
    console.log(`Distribution by specified percentages:`);
    
    // Display distribution details
    recipients.forEach((recipient, index) => {
      console.log(`${index + 1}. ${recipient.owner.substring(0, 12)}... - ${recipient.percentage.toFixed(2)}% - ${recipient.solAmount.toFixed(6)} SOL`);
    });
    
    console.log(`Reserved for fees: 0.001 SOL`);
    
    // Confirm with user
    const confirmDistribution = await askQuestion('\nContinue with distribution? (yes/no): ');
    if (confirmDistribution.toLowerCase() !== 'yes') {
      console.log('Distribution cancelled');
      return;
    }
    
    // Follow the same distribution process as distributeSol
    await sendIndividualTransactionsByPercentage(keyPair, recipients);
    
  } catch (error) {
    console.error('Error checking SOL balance:', error.message);
  }
}

// Start the program
console.log('=== PumpFun Token Manager ===');
showMainMenu();
