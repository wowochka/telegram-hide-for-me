# Submission to @designers

Submissions go to @designers by direct message: open <https://t.me/designers> in Telegram and use the channel's message button.

Send it as **one message**: the video, sent as a video (not as a file) so it plays inline, with the caption below. The caption fits Telegram's 1,024-character limit and carries the link to the code.

- Video: `video/hide-for-me.mp4`
- Code: <https://github.com/wowochka/telegram-hide-for-me>

## Caption

```text
Hide for Me: mute a person, not the group.

When one member floods a group, the only options today are muting or leaving the whole chat. Hide for Me hides one person's messages in one group, only for you.

Long-press their message → Hide Max for Me → 1 hour / until tomorrow / always. Their messages dissolve into spoiler dust and fold into a quiet row ("4 hidden messages from Max"). They keep typing, you get quiet: no notifications, no unread badge. Replies and mentions still come through. Tap the row to peek. The header shows "1 hidden"; Undo has the usual countdown.

Nobody else is affected and nobody is told: it's a client-side view filter, no server changes.

The video is rendered frame by frame from a working prototype (iOS 26 UI recreated on the web, TypeScript), with 25 automated tests.

Code: https://github.com/wowochka/telegram-hide-for-me

Independent concept.
```

## Follow-up, only if they ask how it works

```text
A rule is { chat, user, until or forever, showReplies }, stored with local chat settings (it could sync across your own devices like other personal settings, never visible to anyone else). Hidden messages are still received and stored, so peeking and un-hiding are instant. The message list folds consecutive hidden messages into one placeholder, and unread counters and notifications skip them, except messages that reply to you or mention you.

In the repo: src/hide/store.ts (rules, durations, expiry, persistence) and src/hide/collapse.ts (folding, peeking, the reply/mention exception, unread/notify filters), with unit and Playwright tests.
```
