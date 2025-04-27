// SIGNUP
// We save mf to a database, signup state incomplete
// Guy starts the bot
// If his signup is not complete
// We check his handle. If handle is present in our DB,
// remember his tg id. Signup complete, send him a message like "we know you now"

// SIGNIN
// Prerequisite: guy signup'd
// We send to chat with his ID an OTP password. If no such guy or signup not complete, send 404
// Save OTP to temporary storage

// Confirm OTP
// If he enters coorectly, let him in. If not, re-send OTP

// test case: no sql injection possible
