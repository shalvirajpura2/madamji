"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectionState } from "livekit-client";
import {
  useAgent,
  useIsSpeaking,
  useLocalParticipant,
  useSessionContext,
  useTrackVolume,
  useTranscriptions,
} from "@livekit/components-react";
import type { TeacherPose } from "@/components/teacher";
import type { Chapter } from "@/lib/content";
import { parseLesson } from "@/lib/lesson";
import { ClassroomView } from "./classroom-view";
import type { StatusTone } from "./controls";

type Props = { chapter: Chapter; nextChapter: { id: string; title: string } | null; onLeave: () => void };

export function LiveClassroom({ chapter, nextChapter, onLeave }: Props) {
  const session = useSessionContext();
  const agent = useAgent();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const studentSpeaking = useIsSpeaking(localParticipant);
  const transcriptions = useTranscriptions();
  const level = useTrackVolume(agent.microphoneTrack);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const micBeforePause = useRef(false);

  const lesson = useMemo(() => parseLesson(agent.attributes?.lesson), [agent.attributes]);

  // a new question state means the agent has handled the tap
  const questionKey = `${lesson?.question?.id}-${lesson?.question?.status}`;
  const lastKey = useRef(questionKey);
  useEffect(() => {
    if (questionKey !== lastKey.current) {
      lastKey.current = questionKey;
      setPending(false);
    }
  }, [questionKey]);

  const captions = useMemo(() => {
    const agentId = agent.identity;
    let teacher = "";
    let student = "";
    for (const t of transcriptions) {
      if (t.participantInfo.identity === agentId) teacher = t.text;
      else if (t.participantInfo.identity === localParticipant.identity) student = t.text;
    }
    return { teacher, student };
  }, [transcriptions, agent.identity, localParticipant.identity]);

  async function call(method: string, payload: object = {}) {
    if (!agent.identity) return null;
    try {
      setActionError(null);
      return await localParticipant.performRpc({
        destinationIdentity: agent.identity,
        method,
        payload: JSON.stringify(payload),
        responseTimeout: 10_000,
      });
    } catch (e) {
      console.error(`rpc ${method} failed`, e);
      setActionError("Ma'am didn't get that. Please try again, or just say it out loud.");
      return null;
    }
  }

  async function sendText(text: string) {
    try {
      await localParticipant.sendText(text, { topic: "lk.chat" });
    } catch {
      setActionError("Your message didn't go through. Please try again.");
    }
  }

  const pose: TeacherPose =
    agent.state === "speaking"
      ? "speaking"
      : agent.state === "thinking"
        ? "thinking"
        : studentSpeaking
          ? "listening"
          : "idle";

  const status = statusFor({
    connected: agent.isConnected,
    agentState: agent.state,
    failed: agent.state === "failed",
    reconnecting: session.connectionState === ConnectionState.Reconnecting || session.connectionState === ConnectionState.SignalReconnecting,
    studentSpeaking,
    micOn: isMicrophoneEnabled,
    phase: lesson?.phase,
    paused: Boolean(lesson?.pausedAt),
    trouble: lesson?.status === "trouble" || lesson?.status === "ended",
  });

  let banner = actionError;
  if (lesson?.status === "ended") {
    banner = "Ma'am had a technical problem and had to stop the class. Your progress is saved. Leave and enter the class again to continue.";
  } else if (agent.state === "failed") {
    banner = "Ma'am couldn't join the class. The teacher service may be starting up, please leave and try again in a minute.";
  } else if (status.tone === "connecting" && session.connectionState === ConnectionState.Reconnecting) {
    banner = "Your internet dropped for a moment. Reconnecting…";
  }

  return (
    <ClassroomView
      chapter={chapter}
      lesson={lesson}
      teacher={{ pose, mood: lesson?.mood ?? "calm", level: pose === "speaking" ? level : 0 }}
      status={status}
      captions={captions}
      micOn={isMicrophoneEnabled}
      hearing={studentSpeaking && isMicrophoneEnabled}
      banner={banner}
      pendingAnswer={pending}
      nextChapter={nextChapter}
      onAnswer={async (questionId, answer) => {
        setPending(true);
        const res = await call("answer", { questionId, ...answer });
        if (!res) setPending(false);
      }}
      onRaiseHand={() => call("raise_hand")}
      onPause={async () => {
        // a real pause: Ma'am stops and the mic goes off until resume
        micBeforePause.current = isMicrophoneEnabled;
        if (isMicrophoneEnabled) await localParticipant.setMicrophoneEnabled(false).catch(() => {});
        await call("pause");
      }}
      onResume={async () => {
        if (micBeforePause.current) await localParticipant.setMicrophoneEnabled(true).catch(() => {});
        await call("resume");
      }}
      onContinue={() => call("continue")}
      onHint={() => sendText("Ma'am, can I get a hint please?")}
      onToggleMic={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => {
        setActionError("We couldn't turn on your mic. Check the browser's microphone permission.");
      })}
      onSendText={sendText}
      onLeave={onLeave}
    />
  );
}

function statusFor(s: {
  connected: boolean;
  agentState: string;
  failed: boolean;
  reconnecting: boolean;
  studentSpeaking: boolean;
  micOn: boolean;
  phase?: string;
  paused: boolean;
  trouble: boolean;
}): { tone: StatusTone; text: string } {
  if (s.failed) return { tone: "trouble", text: "Ma'am couldn't join the class" };
  if (s.reconnecting) return { tone: "connecting", text: "Reconnecting…" };
  if (!s.connected || s.agentState === "initializing" || s.agentState === "connecting" || s.agentState === "pre-connect-buffering") {
    return { tone: "connecting", text: "Ma'am is walking into class…" };
  }
  if (s.trouble) return { tone: "trouble", text: "Ma'am's voice is having trouble. Give it a moment…" };
  if (s.paused) return { tone: "paused", text: "Class paused · Ma'am is not listening. Tap Resume to continue" };
  if (s.agentState === "speaking") return { tone: "speaking", text: "Ma'am is speaking · just talk to interrupt" };
  if (s.agentState === "thinking") return { tone: "thinking", text: "Ma'am is thinking…" };
  if (s.studentSpeaking && s.micOn) return { tone: "you", text: "Listening to you…" };
  if (!s.micOn) return { tone: "muted", text: "Your mic is off · tap the mic to talk, or type" };
  if (s.phase === "question") return { tone: "turn", text: "Your turn! Say or tap your answer" };
  if (s.phase === "check") return { tone: "turn", text: "Any doubts? Ask now, or tap No doubts" };
  if (s.phase === "wrap") return { tone: "listening", text: "Class complete! Ask anything, or pick the next chapter" };
  return { tone: "listening", text: "Ma'am is listening" };
}
