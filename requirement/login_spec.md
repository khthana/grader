# Frontend: Login Page

## Overview

The Login page is the entry point of the **Python Programming Automated Grader** system. It supports two authentication methods: Google OAuth and username/password. Upon successful authentication, the user is redirected to the main dashboard.

---

## User Flow

### Path A — Google Authentication

1. User navigates to the login page.
2. User clicks **"Sign in with Google"**.
3. System redirects the user to Google OAuth consent screen.
4. Upon successful Google authentication, Google redirects back to the app with an auth code.
5. System validates the token and creates/resumes the session.
6. User is redirected to the main dashboard.

### Path B — Username & Password

1. User navigates to the login page.
2. User enters email and password, then clicks **"Login"**.
3. System validates inputs client-side (see Input Validation).
4. System sends credentials to the backend.
5. On success, session is established and user is redirected to the main dashboard.
6. On failure, an appropriate error message is displayed inline.

---

## Input Validation

| Field | Rule | Error Message |
|---|---|---|
| Email | Required. Must be a valid email format (e.g. `user@kmitl.ac.th`) | "Please enter a valid email address." |
| Password | Required. Minimum 8 characters. Must contain at least one uppercase letter, one lowercase letter, one number, and one special character (e.g. `!@#$%`) | "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character." |

> Validation fires on **submit**, not on every keystroke.

---

## UI Requirements

- Follow the layout and visual style defined in `DESIGN.md` (colors, typography, spacing, components).
- The login form must be centered and responsive across screen sizes (mobile, tablet, desktop).
- Two clearly separated login options: Google button (primary) and email/password form (secondary, separated by a divider).
- Show a loading indicator while authentication is in progress (disable the login button to prevent double-submit).

---

## Error Handling

| Scenario | Message |
|---|---|
| Invalid email format | "Please enter a valid email address." |
| Password too weak | "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character." |
| Wrong email or password | "Invalid email or password. Please try again." |
| Google auth cancelled or failed | "Google sign-in was cancelled or failed. Please try again." |
| Server / network error | "Something went wrong. Please try again later." |
| Account not found / unauthorized | "Your account is not registered in this system. Please contact your administrator." |

---

## Security Considerations

- Rate-limit login attempts (e.g. lock for 5 minutes after 5 consecutive failures).
- Do not indicate whether the email exists — always return a generic "Invalid email or password" message.
- Transmit credentials over HTTPS only.
- Session token must be stored in an HttpOnly cookie (not localStorage).

---

## Out of Scope

- User registration / sign-up
- Forgot password flow *(link may be displayed but implementation is a separate requirement)*
- Main dashboard page *(separate requirement)*

---

## Test Cases

| # | Scenario | Input | Expected Result |
|---|---|---|---|
| TC-01 | Valid login | Email: `user@kmitl.ac.th`, Password: `Secure@123` | Redirect to main dashboard |
| TC-02 | Empty email | Email: *(blank)*, Password: `Secure@123` | Show: "Please enter a valid email address." |
| TC-03 | Invalid email format | Email: `notanemail`, Password: `Secure@123` | Show: "Please enter a valid email address." |
| TC-04 | Empty password | Email: `user@kmitl.ac.th`, Password: *(blank)* | Show password required error |
| TC-05 | Weak password | Email: `user@kmitl.ac.th`, Password: `password123` | Show: "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character." |
| TC-06 | Wrong password | Email: `user@kmitl.ac.th`, Password: `WrongPass!1` | Show: "Invalid email or password. Please try again." |
| TC-07 | Unregistered email | Email: `ghost@kmitl.ac.th`, Password: `Secure@123` | Show: "Invalid email or password. Please try again." *(same message — do not reveal if email exists)* |
| TC-08 | Server error | *(simulate 500 from backend)* | Show: "Something went wrong. Please try again later." |
| TC-09 | Google auth — success | Click "Sign in with Google" → complete Google flow | Redirect to main dashboard |
| TC-10 | Google auth — cancelled | Click "Sign in with Google" → cancel on Google screen | Show: "Google sign-in was cancelled or failed. Please try again." |
| TC-11 | Double submit | Click login twice rapidly | Button disabled after first click; only one request sent |