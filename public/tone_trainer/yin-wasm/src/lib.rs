use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct YinResult {
    pitch: f64,
    confidence: f64,
    tau: i32,
}

#[wasm_bindgen]
impl YinResult {
    #[wasm_bindgen(getter)]
    pub fn pitch(&self) -> f64 {
        self.pitch
    }

    #[wasm_bindgen(getter)]
    pub fn confidence(&self) -> f64 {
        self.confidence
    }

    #[wasm_bindgen(getter)]
    pub fn tau(&self) -> i32 {
        self.tau
    }
}

/// Compute the YIN difference function
#[inline]
fn yin_difference_function(buffer: &[f32]) -> Vec<f32> {
    let buffer_size = buffer.len();
    let half_size = buffer_size / 2;
    let mut difference_function = vec![0.0; half_size];

    // Step 1: Difference function d_t(τ) = Σ(x_j - x_{j+τ})²
    for tau in 0..half_size {
        let mut sum = 0.0;
        for j in 0..half_size {
            let delta = buffer[j] - buffer[j + tau];
            sum += delta * delta;
        }
        difference_function[tau] = sum;
    }

    difference_function
}

/// Compute cumulative mean normalized difference
#[inline]
fn yin_cumulative_mean_normalized_difference(difference_function: &[f32]) -> Vec<f32> {
    let len = difference_function.len();
    let mut cmndf = vec![0.0; len];
    cmndf[0] = 1.0;

    let mut running_sum = 0.0;
    for tau in 1..len {
        running_sum += difference_function[tau];
        cmndf[tau] = difference_function[tau] / (running_sum / tau as f32);
    }

    cmndf
}

/// Find the absolute threshold
#[inline]
fn yin_absolute_threshold(cmndf: &[f32], threshold: f32) -> i32 {
    // Step 3: Absolute threshold - find first minimum below threshold
    let mut tau = 2;
    while tau < cmndf.len() {
        if cmndf[tau] < threshold {
            // Check if this is a local minimum
            while tau + 1 < cmndf.len() && cmndf[tau + 1] < cmndf[tau] {
                tau += 1;
            }
            return tau as i32;
        }
        tau += 1;
    }
    -1 // No period found
}

/// Parabolic interpolation for better accuracy
#[inline]
fn yin_parabolic_interpolation(cmndf: &[f32], tau_estimate: i32) -> f32 {
    let tau = tau_estimate as usize;
    if tau < 1 || tau >= cmndf.len() - 1 {
        return tau_estimate as f32;
    }

    let s0 = cmndf[tau - 1];
    let s1 = cmndf[tau];
    let s2 = cmndf[tau + 1];

    // Parabolic interpolation formula
    tau_estimate as f32 + (s2 - s0) / (2.0 * (2.0 * s1 - s2 - s0))
}

/// Perform YIN analysis on audio buffer
/// Returns a flat array of results: [pitch1, confidence1, tau1, pitch2, confidence2, tau2, ...]
#[wasm_bindgen]
pub fn perform_yin_analysis(
    audio_data: &[f32],
    sample_rate: f32,
    frame_size: usize,
    hop_size: usize,
    threshold: f32,
    min_freq: f32,
    max_freq: f32,
    interpolation: bool,
) -> Vec<f32> {
    let mut results = Vec::new();

    let audio_len = audio_data.len();
    if audio_len < frame_size {
        return results;
    }

    let num_frames = (audio_len - frame_size) / hop_size + 1;
    results.reserve(num_frames * 3); // pitch, confidence, tau for each frame

    let mut i = 0;
    while i + frame_size <= audio_len {
        let frame = &audio_data[i..i + frame_size];

        // Step 1: Difference function
        let difference_function = yin_difference_function(frame);

        // Step 2: Cumulative mean normalized difference function
        let cmndf = yin_cumulative_mean_normalized_difference(&difference_function);

        // Step 3: Absolute threshold
        let tau_estimate = yin_absolute_threshold(&cmndf, threshold);

        let (pitch, confidence) = if tau_estimate > 0 {
            // Step 4: Parabolic interpolation (if enabled)
            let better_tau = if interpolation {
                yin_parabolic_interpolation(&cmndf, tau_estimate)
            } else {
                tau_estimate as f32
            };

            // Convert tau to frequency
            let freq = sample_rate / better_tau;

            // Confidence is inverse of CMNDF value at the estimated tau
            let conf = 1.0 - cmndf[tau_estimate as usize];

            // Filter out unrealistic pitches
            if freq >= min_freq && freq <= max_freq {
                (freq, conf)
            } else {
                (0.0, 0.0)
            }
        } else {
            (0.0, 0.0)
        };

        // Store results as flat array: pitch, confidence, tau
        results.push(pitch);
        results.push(confidence);
        results.push(tau_estimate as f32);

        i += hop_size;
    }

    results
}

/// Get the number of frames that will be analyzed
#[wasm_bindgen]
pub fn get_frame_count(audio_len: usize, frame_size: usize, hop_size: usize) -> usize {
    if audio_len < frame_size {
        return 0;
    }
    (audio_len - frame_size) / hop_size + 1
}
