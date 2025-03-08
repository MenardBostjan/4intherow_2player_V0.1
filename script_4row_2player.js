'use strict';

// Import Firebase Realtime Database functions explicitly
import { ref, set, onValue, push, onChildAdded, update, get, onDisconnect } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

// Get database from global scope (initialized in index.html)
const database = window.database;
const gameRef = ref(database, 'game'); // Reference to the 'game' node in Firebase
const chatRef = ref(database, 'chat'); // Reference to the 'chat' node in Firebase


document.addEventListener('DOMContentLoaded', function() {
    const chatDisplay = document.getElementById('chat-display');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const gameBoardElement = document.getElementById('game-board');
    const newGameButton = document.getElementById('new-game-button');
    const gameStatusElement = document.getElementById('game-status'); // Get game status div

    let gameBoard = [];
    const boardSize = 10;
    let currentPlayer = ''; // Will be set from Firebase
    let gameActive = false; // Will be set from Firebase
    let userInteractionEnabled = false; // Initially disabled until game starts
    let playerSymbol = ''; // Will be assigned 'X' or 'O'
    let opponentSymbol = '';
    let playerDisplayName = ''; // 'Player 1' or 'Player 2'
    let opponentDisplayName = '';

    // Function to initialize the game state in Firebase
    function initializeFirebaseGame() {
        const initialGameState = { // Base game state
            currentPlayer: 'X',
            gameActive: true,
            playerXConnected: true,
            playerOConnected: false
        };

        console.log("initializeFirebaseGame() - initialGameState object (base vars):", initialGameState);

        // Merge board variables directly into initialGameState object - Initialize to "-"
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const varName = `${row.toString().padStart(2, '0')}_${col.toString().padStart(2, '0')}`;
                initialGameState[varName] = "-"; // Initialize to "-" (string) - CHANGED to "-"
            }
        }

        console.log("initializeFirebaseGame() - initialGameState object (merged vars):", initialGameState); // Log merged object

        set(gameRef, initialGameState) // Use 'set' to write the COMPLETE merged object
            .then(() => {
                console.log("Firebase game state initialized (merged vars - '-' values) - SUCCESS - New Game Button or Initial Load."); // Updated log
                startGame();
            })
            .catch((error) => {
                console.error("Firebase set error (merged vars - '-' values) - New Game Button or Initial Load:", error); // Updated log
                displayMessage("Error starting new game.", 'system');
            });
    }


    // Function to start attaching listeners and update status - **RENDER BOARD MOVED TO onValue LISTENER**
    function startGame() {
        if (!gameActive) {
            attachFirebaseListeners(); // Set up listeners for game and chat data
            gameActive = true; // gameActive will be properly set in onValue listener based on Firebase data
            updateGameStatusDisplay(); // Initial status update - status might be updated again in onValue
        }
    }


    function renderGameBoard() {
        gameBoardElement.innerHTML = '';
        gameBoardElement.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;

        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const cell = document.createElement('div');
                cell.classList.add('game-cell');
                cell.dataset.row = row;
                cell.dataset.col = col;

                // Get the variable name for this cell
                const varName = `${row.toString().padStart(2, '0')}_${col.toString().padStart(2, '0')}`;
                const cellValue = gameBoard[row][col]; // Get cell value from gameBoard array

                if (cellValue === 'O') {
                    cell.textContent = 'O';
                    cell.classList.add('o-piece');
                } else if (cellValue === 'X') {
                    cell.textContent = 'X';
                    cell.classList.add('x-piece');
                } else {
                    cell.textContent = ''; // If cellValue is "-" or anything else (empty cell), display nothing
                    // No class needed for empty cells
                }


                cell.addEventListener('click', handleCellClick);
                gameBoardElement.appendChild(cell);
                cell.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}`); // Accessibility label
            }
        }
    }

    function handleCellClick(event) {
        if (!userInteractionEnabled || !gameActive || currentPlayer !== playerSymbol) return;

        const cell = event.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        if (gameBoard[row][col] === "-") { // Check if cell is "-" (empty) - CHANGED to "-"
            // Fetch the current gameState from Firebase *before* updating
            get(gameRef)
                .then(snapshot => {
                    const gameState = snapshot.val();
                    if (gameState) {
                        // Update the specific board variable in Firebase
                        const varName = `${row.toString().padStart(2, '0')}_${col.toString().padStart(2, '0')}`;
                        const updates = {};
                        updates[varName] = playerSymbol; // Update specific cell variable
                        updates['currentPlayer'] = (gameState.currentPlayer === 'X' ? 'O' : 'X'); // Correctly switch player turn - using fetched gameState
                        update(gameRef, updates) // Use imported 'update' function and gameRef
                            .catch(error => {
                                console.error("Error updating game state in Firebase (100 vars):", error);
                                displayMessage("Error making move. Please try again.", 'system');
                            });
                    } else {
                        console.error("Error: gameState is null when handling cell click.");
                        displayMessage("Error processing move. Game state not available.", 'system');
                    }
                })
                .catch(error => {
                    console.error("Error fetching gameState from Firebase:", error);
                    displayMessage("Error fetching game state. Please try again.", 'system');
                });
        }
    }

    function updateGameStatusDisplay() {
        let statusMessage = '';
        if (!gameActive) {
            statusMessage = "Game Over";
        } else if (currentPlayer === playerSymbol) {
            statusMessage = "Your turn (" + playerDisplayName + " - '" + playerSymbol + "')"; // Player 1 or Player 2
        } else if (currentPlayer === opponentSymbol) {
            statusMessage = "Opponent's turn (" + opponentDisplayName + " - '" + opponentSymbol + "')"; // Player 1 or Player 2
        } else {
            statusMessage = "Waiting for game state...";
        }
        if (gameStatusElement) {
            gameStatusElement.textContent = statusMessage; // Update status div content
        }
    }


    function checkWinCondition(player) { // (No changes needed in logic here)
        console.log(`Checking win condition for player: ${player}`); // ADD THIS LINE - DEBUG
        const winConditionLength = 4;
        const directions = [
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 1, dy: 1 },
            { dx: 1, dy: -1 }
        ];

        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (gameBoard[row][col] === player) {
                    for (const dir of directions) {
                        let count = 1;
                        for (let i = 1; i < winConditionLength; i++) {
                            const checkRow = row + i * dir.dy;
                            const checkCol = col + i * dir.dx;

                            if (checkRow >= 0 && checkCol < boardSize && checkCol >= 0 && checkCol < boardSize && gameBoard[checkRow][checkCol] === player) {
                                count++;
                            } else {
                                break;
                            }
                        }
                        if (count >= winConditionLength) {
                            console.log(`Win condition met for player: ${player}`); // ADD THIS LINE - DEBUG
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }


    function isBoardFull() { // (No changes needed in logic here)
        console.log("Checking if board is full"); // ADD THIS LINE - DEBUG
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (gameBoard[row][col] === "-") { // Check for "-" instead of null - CHANGED to "-"
                    return false;
                }
            }
        }
        console.log("Board is full"); // ADD THIS LINE - DEBUG
        return true;
    }


    function endGame(winner) {
        console.log(`endGame function called with winner: ${winner}`); // ADD THIS LINE - DEBUG
        // Update gameActive status in Firebase
        set(ref(database, 'game/gameActive'), false) // Use imported 'set' function and ref() with database
            .then(() => {
                console.log("Game over status updated in Firebase.");
                gameActive = false; // Update local gameActive immediately
                userInteractionEnabled = false; // Disable local interaction

                let message = '';
                if (winner === 'X') {
                    message = "Player " + playerDisplayName + " (Player X) wins! Congratulations!"; // Player 1 or Player 2
                } else if (winner === 'O') {
                    message = "Player " + opponentDisplayName + " (Player O) wins! Congratulations!"; // Player 1 or Player 2 - using opponentDisplayName for 'O' winner
                } else if (winner === 'draw') {
                    message = "It's a draw! The board is full.";
                }
                displayMessage(message, 'system');
                updateGameStatusDisplay(); // Final status update
            })
            .catch(error => {
                console.error("Error updating gameActive in Firebase:", error);
                displayMessage("Error ending game.", 'system');
            });
    }


    function displayMessage(message, sender) { // (No changes needed in logic here)
        // --- STEP 3 DEBUGGING: Add console.log here ---
        // console.log("displayMessage function called:", message, sender);
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        if (sender) {
            const sanitizedSender = sender.replace(/\s+/g, '_'); // Sanitize sender for CSS class - replace spaces with underscores
            messageElement.classList.add(`${sanitizedSender}-message`);
        }
        messageElement.textContent = message;
        chatDisplay.appendChild(messageElement);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

    function enableGameInteraction() {
        userInteractionEnabled = true;
        gameBoardElement.classList.remove('disabled');
        updateGameStatusDisplay();
        console.log("enableGameInteraction() called"); // DEBUG
    }

    function disableGameInteraction() {
        userInteractionEnabled = false;
        gameBoardElement.classList.add('disabled');
        updateGameStatusDisplay();
        console.log("disableGameInteraction() called"); // DEBUG
    }


    function sendMessage() {
        const messageText = messageInput.value;
        if (messageText.trim()) {
            // Sanitize playerDisplayName for chat sender - replace spaces with underscores
            const sanitizedDisplayName = playerDisplayName.replace(/\s+/g, '_');
            // Push new message to Firebase chat node
            push(chatRef, { // Use imported 'push' function and chatRef
                sender: sanitizedDisplayName || 'Unknown', // Use sanitized name for sender - Player_1 or Player_2 or Unknown
                text: messageText
            })
            .catch(error => {
                console.error("Error sending chat message to Firebase:", error);
                displayMessage(message, 'system');
            });
            messageInput.value = '';
        }
    }


    function attachFirebaseListeners() {
        // Listener for game state changes - **RENDER BOARD IS NOW CALLED HERE, AFTER gameState is set**
        onValue(gameRef, (snapshot) => { // Use imported 'onValue' function and gameRef
            const gameState = snapshot.val();
            if (gameState) {
                // Reconstruct gameBoard from 100 individual variables
                gameBoard = Array.from({ length: boardSize }, () => Array(boardSize).fill(null)); // Initialize empty 2D array
                for (let row = 0; row < boardSize; row++) {
                    for (let col = 0; col < boardSize; col++) {
                        const varName = `${row.toString().padStart(2, '0')}_${col.toString().padStart(2, '0')}`;
                        gameBoard[row][col] = gameState[varName]; // Populate from individual variables
                    }
                }

                currentPlayer = gameState.currentPlayer;
                gameActive = gameState.gameActive;

                console.log("onValue - Firebase gameState (100 vars) received - gameBoard reconstructed:", gameBoard); // Log reconstructed gameBoard

                // Player Assignment Logic (Simple - First connected is X, second is O)
                if (!playerSymbol) { // Only assign once per session
                    if (gameState.playerXConnected && !gameState.playerOConnected) {
                        playerSymbol = 'X';
                        opponentSymbol = 'O';
                        playerDisplayName = 'Player 1'; // Assign Player 1 name
                        opponentDisplayName = 'Player 2';
                        const playerOConnectedRef = ref(database, 'game/playerOConnected');
                        set(playerOConnectedRef, true);
                        onDisconnect(playerOConnectedRef).set(false);
                        displayMessage(`You are Player 1 ('X'). Waiting for Player 2...`, 'system'); // Player 1 name in message
                        console.log(`currentPlayer: ${currentPlayer}, playerSymbol: ${playerSymbol}, opponentSymbol: ${opponentSymbol}`); // DEBUG
                        if (currentPlayer === 'X') enableGameInteraction(); else disableGameInteraction();
                    } else if (gameState.playerXConnected && gameState.playerOConnected) {
                        playerSymbol = 'O';
                        opponentSymbol = 'X';
                        playerDisplayName = 'Player 2'; // Assign Player 2 name
                        opponentDisplayName = 'Player 1';
                        const playerXConnectedRef = ref(database, 'game/playerXConnected');
                        onDisconnect(playerXConnectedRef).set(false);
                        displayMessage(`You are Player 2 ('O'). Game started! Player 1's turn.`, 'system'); // Player 2 name in message
                        console.log(`currentPlayer: ${currentPlayer}, playerSymbol: ${playerSymbol}, opponentSymbol: ${opponentSymbol}`); // DEBUG
                        if (currentPlayer === 'O') enableGameInteraction(); else disableGameInteraction();
                    } else {
                        // This case should ideally not be reached after initial setup, but handle for robustness
                        playerSymbol = 'Spectator'; // Or handle unassigned player state
                        opponentSymbol = 'Spectator';
                        playerDisplayName = 'Spectator';
                        opponentDisplayName = 'Spectator';
                        displayMessage("Spectating or waiting for players...", 'system');
                        disableGameInteraction(); // Spectators cannot interact
                    }
                }

                renderGameBoard(); // **RENDER BOARD IS CALLED HERE - AFTER gameBoard IS RECONSTRUCTED**
                updateGameStatusDisplay();

                // --- WIN CONDITION AND GAME OVER CHECK ---
                if (gameActive) { // Only check if the game is still active
                    if (checkWinCondition('X')) {
                        console.log("Player X wins!"); // Debug log
                        endGame('X');
                    } else if (checkWinCondition('O')) {
                        console.log("Player O wins!"); // Debug log
                        endGame('O');
                    } else if (isBoardFull()) {
                        console.log("It's a draw!"); // Debug log
                        endGame('draw');
                    } else {
                        console.log(`currentPlayer: ${currentPlayer}, playerSymbol: ${playerSymbol}, opponentSymbol: ${opponentSymbol}`); // DEBUG - before enable/disable
                        if (currentPlayer === playerSymbol) {
                            enableGameInteraction(); // Enable interaction for current player
                        } else if (currentPlayer === opponentSymbol) {
                            disableGameInteraction(); // Disable interaction for opponent's turn
                        } else {
                            disableGameInteraction(); // Default to disabled if player assignment is unclear
                        }
                    }
                } else { // gameActive is false from Firebase
                    disableGameInteraction(); // Ensure interaction is disabled if game over from Firebase
                    if (checkWinCondition('X')) {
                        displayMessage("Player 1 wins!", 'system'); // Player 1 name in message
                    } else if (checkWinCondition('O')) {
                        displayMessage("Player 2 wins!", 'system'); // Player 2 name in message
                    } else if (isBoardFull()) {
                        displayMessage("It's a draw!", 'system');
                    }
                }
            } else {
                // Handle case where game state is not yet initialized in Firebase (e.g., on first load)
                displayMessage("Waiting for game to initialize...", 'system');
            }
        }, {
            onlyOnce: false // Set to false for continuous listening for changes
        });


        // Listener for new chat messages (No changes needed here)
        onChildAdded(chatRef, (snapshot) => {
            const chatMessage = snapshot.val();
            // --- STEP 2 DEBUGGING: Add console.log here ---
            // console.log("Chat message received from Firebase:", chatMessage);
            if (chatMessage) {
                const sender = chatMessage.sender; // Sender might be sanitized already in sendMessage
                displayMessage(chatMessage.sender + ": " + chatMessage.text, sender); // Use original sender for displayMessage
            }
        });
    }


    // Initial setup - try to get existing game or initialize a new one
    // Check if game node exists, if not, initialize. If it exists, listeners will handle setup.
    get(ref(database, 'game')) // Use imported 'get'
        .then(snapshot => {
            if (!snapshot.exists()) {
                console.log("No existing game state found in Firebase, initializing new game (merged vars - '-' values).");
                initializeFirebaseGame(); // Initialize a new game if no game node exists, startGame will be called after init.
            } else {
                console.log("Existing game state found in Firebase, attaching listeners (merged vars - '-' values).");
                startGame(); // If game state exists, just start listening and UI - renderGameBoard will be called in onValue
            }
        })
        .catch(error => {
            console.error("Error checking for existing game state (merged vars - '-' values):", error);
            displayMessage("Error checking game state. Please refresh.", 'system');
        });

        // New Game Button Event Listener
        newGameButton.addEventListener('click', function() {
            console.log("New Game button clicked");
            initializeFirebaseGame(); // Call initializeFirebaseGame to reset the game in Firebase
        });


    // Send Chat Message on Button Click
    sendButton.addEventListener('click', function(event) {
        event.preventDefault(); // Prevent default form submission
        sendMessage();
    });

    // Send Chat Message on Enter Key (in message input)
    messageInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) { // Check for Enter key without Shift
            event.preventDefault(); // Prevent newline in textarea
            sendMessage();
        }
    });

});