package app.wishrack;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.PersistableBundle;
import android.provider.MediaStore;

/**
 * Background work, scheduled through Android's own JobScheduler (no extra libraries):
 * - TRIGGER runs a few seconds after any new image appears (one-shot, re-armed after each run);
 * - PERIODIC is the 15-minute backup check, which survives restarts and retries failures;
 * - SHARE processes images shared to Wishrack.
 */
public class ShotJob extends JobService {
    static final int TRIGGER = 1, PERIODIC = 2, SHARE = 3;

    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try {
                if (params.getJobId() == SHARE) Processor.runFiles(this, params.getExtras().getStringArray("files"));
                else Processor.runScreenshots(this);
            } catch (Throwable ignored) { }
            jobFinished(params, false); // failures wait for the next periodic run
            if (params.getJobId() != SHARE) schedule(this); // re-arm the one-shot trigger
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) { return true; }

    static void schedule(Context c) {
        // Scheduling must never take the app down with it; a failure here only costs automatic saving.
        try { scheduleJobs(c); } catch (RuntimeException e) {
            Processor.prefs(c).edit().putString("status", "Automatic saving couldn't start: " + e.getMessage()).apply();
        }
    }

    private static void scheduleJobs(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        ComponentName cn = new ComponentName(c, ShotJob.class);
        if (!Processor.prefs(c).getBoolean("auto", true)) {
            js.cancel(TRIGGER);
            js.cancel(PERIODIC);
            return;
        }
        js.schedule(new JobInfo.Builder(TRIGGER, cn)
                .addTriggerContentUri(new JobInfo.TriggerContentUri(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, JobInfo.TriggerContentUri.FLAG_NOTIFY_FOR_DESCENDANTS))
                .setTriggerContentUpdateDelay(4000)
                .setTriggerContentMaxDelay(60000)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .build());
        if (js.getPendingJob(PERIODIC) == null) {
            js.schedule(new JobInfo.Builder(PERIODIC, cn)
                    .setPeriodic(15 * 60 * 1000L)
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPersisted(true)
                    .build());
        }
    }

    static void processShared(Context c, String[] files) {
        PersistableBundle extras = new PersistableBundle();
        extras.putStringArray("files", files);
        try { c.getSystemService(JobScheduler.class).schedule(new JobInfo.Builder(SHARE, new ComponentName(c, ShotJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setExtras(extras)
                .build()); } catch (RuntimeException e) { new Thread(() -> Processor.runFiles(c, files)).start(); }
    }
}
