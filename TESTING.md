# Testing Plan

## Authentication API

The authentication API is tested with pytest.

The test suite covers all authentication endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`

Each endpoint includes:

- Happy-path test
- Edge-case test
- Failure-mode test

Tests focus on authentication business logic rather than HTTP serialization or FastAPI internals.

---

## Test Cases

### POST /auth/register

#### Happy path
- Register a new user with a valid email and password.
- Verify that the user is created successfully.

#### Edge case
- Attempt to register an email using different letter casing.
- Verify that email comparison remains case-insensitive.

#### Failure mode
- Attempt to register an email that already exists.
- Verify that the request is rejected with a conflict response.

---

### POST /auth/login

#### Happy path
- Login with an existing user and the correct password.
- Verify that an access token is returned.

#### Edge case
- Login using an email with different letter casing.
- Verify that the existing user is still found.

#### Failure mode
- Login with an incorrect password.
- Verify that authentication is rejected.

---

### GET /auth/me

#### Happy path
- Provide a valid access token.
- Verify that the authenticated user's information is returned.

#### Edge case
- Use a valid token for an inactive user.
- Verify that access is rejected.

#### Failure mode
- Provide an invalid or malformed token.
- Verify that authentication is rejected.

---

### POST /auth/forgot-password

#### Happy path
- Request a password reset for an existing user.
- Verify that a reset token is created and the reset email is requested.

#### Edge case
- Request a password reset for an email that does not exist.
- Verify that the endpoint still returns the same generic response.

#### Failure mode
- Simulate an email service failure.
- Verify that the email service error is propagated.

---

### POST /auth/reset-password

#### Happy path
- Use a valid reset token.
- Verify that the user's password is updated.

#### Edge case
- Attempt to reuse a reset token that has already been used.
- Verify that the token is rejected.

#### Failure mode
- Use an invalid or expired reset token.
- Verify that the password is not changed.

---

### POST /auth/change-password

#### Happy path
- Provide the correct current password and a new password.
- Verify that the password is updated.

#### Edge case
- Verify that a password change only occurs when the current password is correct.
- Verify that the update operation is not called when the current password is incorrect.

#### Failure mode
- Provide an incorrect current password.
- Verify that the password is not changed.

---

## Test Isolation

Tests should not modify the real application database.

Authentication data and password-reset token data should be isolated using test fixtures and temporary storage/mocks.

External email delivery through Resend must be mocked so tests never send real emails.

---

## Coverage

Run the complete authentication test suite with:

```bash
uv run pytest