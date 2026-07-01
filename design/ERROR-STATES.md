# Error States

Status: UX/UI specification, no implementation.

## 1. Error Principles

Errors must be:

- clear;
- recoverable where possible;
- non-technical;
- logged;
- close to the failed action.

Never expose stack traces or provider internals to normal users.

## 2. Form Errors

Rules:

- show error next to field;
- preserve entered data;
- explain how to fix;
- focus first invalid field after submit;
- do not rely on color only.

## 3. Widget Message Send Error

Behavior:

- keep unsent message visible;
- show retry action;
- explain that the message was not sent;
- do not create duplicate messages after retry.

## 4. Assistant Unavailable

Message should:

- apologize briefly;
- explain that the assistant is temporarily unavailable;
- offer contact/fallback if configured;
- avoid technical details.

## 5. Dashboard Data Error

Behavior:

- show partial data if safe;
- identify failed widget/panel;
- allow retry;
- log error.

## 6. Export Error

Behavior:

- export job status becomes failed;
- user sees reason in plain language;
- retry action available when safe.

## 7. Permission Error

Message:

- explain that the user lacks access;
- offer route back;
- avoid revealing restricted data.

## 8. Offline State

Admin:

- show offline banner;
- prevent destructive actions;
- retry automatically where safe.

Widget:

- show message send unavailable;
- preserve typed input.

## 9. Error Severity

Levels:

- inline validation;
- recoverable warning;
- blocking error;
- critical system alert.

Critical errors may trigger notification for admin/system owner.
