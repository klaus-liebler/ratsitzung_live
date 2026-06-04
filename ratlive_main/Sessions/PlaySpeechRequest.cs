namespace RatLiveMain.Sessions;

sealed record PlaySpeechRequest(bool ForceStopCurrent = false);
