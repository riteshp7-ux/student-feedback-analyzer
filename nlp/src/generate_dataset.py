import json
from pathlib import Path

# Curated dataset of realistic Indian university student feedback comments.
# Represents simple English, colloquial phrasing, positive, neutral, negative feedback,
# single-topic, multi-topic, and zero-topic examples.
DATASET = [
  # -------------------- TEACHING CLARITY (Positive / Negative / Neutral) --------------------
  {"id": "c001", "text": "The professor explains concepts very clearly and with great depth.", "sentiment": "positive", "topics": ["teaching_clarity"]},
  {"id": "c002", "text": "Sir explains difficult mathematical proofs in a very simple and intuitive manner.", "sentiment": "positive", "topics": ["teaching_clarity"]},
  {"id": "c003", "text": "Explanations on whiteboard are messy and handwriting is not clear at all.", "sentiment": "negative", "topics": ["teaching_clarity"]},
  {"id": "c004", "text": "The conceptual explanations are confusing and jump between topics without structure.", "sentiment": "negative", "topics": ["teaching_clarity"]},
  {"id": "c005", "text": "Slides are readable and concepts are presented in standard textbook order.", "sentiment": "neutral", "topics": ["teaching_clarity"]},
  {"id": "c006", "text": "Very crisp articulation and clear voice during lectures.", "sentiment": "positive", "topics": ["teaching_clarity"]},
  {"id": "c007", "text": "Concept clarity is lacking, sir just reads the bullet points from slides.", "sentiment": "negative", "topics": ["teaching_clarity"]},
  {"id": "c008", "text": "The explanation of dynamic programming was exceptionally well delivered.", "sentiment": "positive", "topics": ["teaching_clarity"]},
  {"id": "c009", "text": "Explanations are neither great nor terrible, just average coverage.", "sentiment": "neutral", "topics": ["teaching_clarity"]},
  {"id": "c010", "text": "Cannot understand the logic behind the derivations presented in class.", "sentiment": "negative", "topics": ["teaching_clarity"]},

  # -------------------- TEACHING PACE --------------------
  {"id": "c011", "text": "The lectures move way too fast and it is impossible to take notes.", "sentiment": "negative", "topics": ["teaching_pace"]},
  {"id": "c012", "text": "Pacing of the course is well-calibrated and gives adequate time to absorb concepts.", "sentiment": "positive", "topics": ["teaching_pace"]},
  {"id": "c013", "text": "Slide changing is too rapid, sir please slow down a bit.", "sentiment": "negative", "topics": ["teaching_pace"]},
  {"id": "c014", "text": "The speed of syllabus completion is extremely slow in the beginning and rushed at the end.", "sentiment": "negative", "topics": ["teaching_pace"]},
  {"id": "c015", "text": "Comfortable teaching pace throughout the semester.", "sentiment": "positive", "topics": ["teaching_pace"]},
  {"id": "c016", "text": "Class pace is steady and conforms to the scheduled syllabus timeline.", "sentiment": "neutral", "topics": ["teaching_pace"]},
  {"id": "c017", "text": "Too much content is crammed into one single hour, pacing is frantic.", "sentiment": "negative", "topics": ["teaching_pace"]},
  {"id": "c018", "text": "The delivery speed is just right for both fast and slow learners.", "sentiment": "positive", "topics": ["teaching_pace"]},

  # -------------------- PRACTICAL EXAMPLES --------------------
  {"id": "c019", "text": "We need more real-world practical examples and industry case studies.", "sentiment": "negative", "topics": ["practical_examples"]},
  {"id": "c020", "text": "Great live coding demonstrations during every lecture session.", "sentiment": "positive", "topics": ["practical_examples"]},
  {"id": "c021", "text": "Too theoretical with zero practical implementation or lab walkthroughs.", "sentiment": "negative", "topics": ["practical_examples"]},
  {"id": "c022", "text": "The hands-on examples solved on board made database query optimization click.", "sentiment": "positive", "topics": ["practical_examples"]},
  {"id": "c023", "text": "Only textbook theory is taught, no practical examples shown for real applications.", "sentiment": "negative", "topics": ["practical_examples"]},
  {"id": "c024", "text": "Examples provided in class are standard textbook ones, nothing groundbreaking.", "sentiment": "neutral", "topics": ["practical_examples"]},
  {"id": "c025", "text": "Loved the practical problem-solving sessions at the end of each module.", "sentiment": "positive", "topics": ["practical_examples"]},
  {"id": "c026", "text": "Please include more code walkthroughs instead of just PowerPoint diagrams.", "sentiment": "negative", "topics": ["practical_examples"]},

  # -------------------- DOUBT HANDLING --------------------
  {"id": "c027", "text": "Doubts asked in class are addressed patiently and never brushed aside.", "sentiment": "positive", "topics": ["doubt_handling"]},
  {"id": "c028", "text": "The professor gets irritated when students ask basic questions and doubts.", "sentiment": "negative", "topics": ["doubt_handling"]},
  {"id": "c029", "text": "Sir is readily accessible during office hours to solve student doubts.", "sentiment": "positive", "topics": ["doubt_handling"]},
  {"id": "c030", "text": "Questions asked in lecture are often ignored or postponed indefinitely.", "sentiment": "negative", "topics": ["doubt_handling"]},
  {"id": "c031", "text": "Doubt clearing sessions happen every Friday as per schedule.", "sentiment": "neutral", "topics": ["doubt_handling"]},
  {"id": "c032", "text": "Very encouraging attitude towards student questions and doubts.", "sentiment": "positive", "topics": ["doubt_handling"]},
  {"id": "c033", "text": "Rarely pauses between topics to check if students have any doubts.", "sentiment": "negative", "topics": ["doubt_handling"]},

  # -------------------- STUDENT ENGAGEMENT --------------------
  {"id": "c034", "text": "Lectures are lively, interactive, and keep the whole hall attentive.", "sentiment": "positive", "topics": ["engagement"]},
  {"id": "c035", "text": "Very monotonous and boring delivery, students end up falling asleep.", "sentiment": "negative", "topics": ["engagement"]},
  {"id": "c036", "text": "Great enthusiasm and energy brought to every lecture.", "sentiment": "positive", "topics": ["engagement"]},
  {"id": "c037", "text": "Zero student interaction, it is purely a one-way monologue for 60 minutes.", "sentiment": "negative", "topics": ["engagement"]},
  {"id": "c038", "text": "Professor asks thought-provoking questions to spark discussion.", "sentiment": "positive", "topics": ["engagement"]},
  {"id": "c039", "text": "Classroom atmosphere is quiet and standard lecture delivery takes place.", "sentiment": "neutral", "topics": ["engagement"]},

  # -------------------- ASSIGNMENTS & GRADING --------------------
  {"id": "c040", "text": "Assignments are practical, challenging, and reinforce learning well.", "sentiment": "positive", "topics": ["assignments"]},
  {"id": "c041", "text": "Homework assignments are way too long and grading is harsh and opaque.", "sentiment": "negative", "topics": ["assignments"]},
  {"id": "c042", "text": "Assignment deadlines are reasonable and feedback on submissions is prompt.", "sentiment": "positive", "topics": ["assignments"]},
  {"id": "c043", "text": "Grading rubrics are not transparent and marks were deducted without reason.", "sentiment": "negative", "topics": ["assignments"]},
  {"id": "c044", "text": "Four coding assignments assigned across the semester as outlined in syllabus.", "sentiment": "neutral", "topics": ["assignments"]},
  {"id": "c045", "text": "Unrealistic workload from weekly assignments alongside project work.", "sentiment": "negative", "topics": ["assignments"]},

  # -------------------- COURSE CONTENT & CURRICULUM --------------------
  {"id": "c046", "text": "The syllabus is modern, well-structured, and covers industry-relevant tools.", "sentiment": "positive", "topics": ["course_content"]},
  {"id": "c047", "text": "Curriculum is outdated and covers obsolete technologies no longer in use.", "sentiment": "negative", "topics": ["course_content"]},
  {"id": "c048", "text": "Recommended textbook and reference materials are very helpful.", "sentiment": "positive", "topics": ["course_content"]},
  {"id": "c049", "text": "The course content is extremely vast and difficult to master in one term.", "sentiment": "negative", "topics": ["course_content"]},
  {"id": "c050", "text": "The curriculum follows the university standard syllabus guidelines.", "sentiment": "neutral", "topics": ["course_content"]},

  # -------------------- MULTI-TOPIC EXAMPLES (Compound / Realistic) --------------------
  {"id": "c051", "text": "The concepts are explained clearly, but we desperately need more practical examples.", "sentiment": "neutral", "topics": ["teaching_clarity", "practical_examples"]},
  {"id": "c052", "text": "Explanations are lucid and clear, but the pace is too rushed to follow derivations.", "sentiment": "neutral", "topics": ["teaching_clarity", "teaching_pace"]},
  {"id": "c053", "text": "Pacing is too fast and doubts are regularly skipped during class.", "sentiment": "negative", "topics": ["teaching_pace", "doubt_handling"]},
  {"id": "c054", "text": "Interactive class discussions and great practical coding examples make this fun.", "sentiment": "positive", "topics": ["engagement", "practical_examples"]},
  {"id": "c055", "text": "Clear teaching and excellent doubt handling during office hours.", "sentiment": "positive", "topics": ["teaching_clarity", "doubt_handling"]},
  {"id": "c056", "text": "Assignments are tough and the pace of lectures is overwhelmingly fast.", "sentiment": "negative", "topics": ["assignments", "teaching_pace"]},
  {"id": "c057", "text": "Very boring lectures with zero practical examples shown on board.", "sentiment": "negative", "topics": ["engagement", "practical_examples"]},
  {"id": "c058", "text": "Modern curriculum topics covered clearly with insightful examples.", "sentiment": "positive", "topics": ["course_content", "teaching_clarity", "practical_examples"]},
  {"id": "c059", "text": "Harsh assignment grading and unwilling to solve student doubts after class.", "sentiment": "negative", "topics": ["assignments", "doubt_handling"]},
  {"id": "c060", "text": "Concepts are clear but slide reading is fast and practical sessions are lacking.", "sentiment": "negative", "topics": ["teaching_clarity", "teaching_pace", "practical_examples"]},
  {"id": "c061", "text": "Patience with student doubts and great interactive engagement throughout.", "sentiment": "positive", "topics": ["doubt_handling", "engagement"]},
  {"id": "c062", "text": "Outdated course syllabus and the professor rushes through the slides.", "sentiment": "negative", "topics": ["course_content", "teaching_pace"]},
  {"id": "c063", "text": "Good practical examples given, but assignments do not match what is taught.", "sentiment": "neutral", "topics": ["practical_examples", "assignments"]},
  {"id": "c064", "text": "Engaging lecturer who explains algorithms with crystal clear logic.", "sentiment": "positive", "topics": ["engagement", "teaching_clarity"]},
  {"id": "c065", "text": "No live examples and doubt clearing is very dismissive.", "sentiment": "negative", "topics": ["practical_examples", "doubt_handling"]},
  {"id": "c066", "text": "The pacing was fine but the assignments were unfairly difficult.", "sentiment": "neutral", "topics": ["teaching_pace", "assignments"]},
  {"id": "c067", "text": "Challenging course content delivered with enthusiasm and great clarity.", "sentiment": "positive", "topics": ["course_content", "engagement", "teaching_clarity"]},
  {"id": "c068", "text": "Theoretical concepts are confusing and pacing is extremely fast.", "sentiment": "negative", "topics": ["teaching_clarity", "teaching_pace"]},
  {"id": "c069", "text": "Clear slides, good doubt clearing, and practical code snippets provided.", "sentiment": "positive", "topics": ["teaching_clarity", "doubt_handling", "practical_examples"]},
  {"id": "c070", "text": "Monotonous delivery, rushed pace, and no real-world relevance shown.", "sentiment": "negative", "topics": ["engagement", "teaching_pace", "practical_examples"]},

  # -------------------- ZERO-TOPIC EXAMPLES (Vague / General Feedback) --------------------
  {"id": "c071", "text": "Great course overall, really enjoyed attending every week.", "sentiment": "positive", "topics": []},
  {"id": "c072", "text": "Did not enjoy the class at all, would not recommend.", "sentiment": "negative", "topics": []},
  {"id": "c073", "text": "Everything was satisfactory and met normal expectations.", "sentiment": "neutral", "topics": []},
  {"id": "c074", "text": "One of the best professors I have had in college so far.", "sentiment": "positive", "topics": []},
  {"id": "c075", "text": "Terrible experience throughout the term.", "sentiment": "negative", "topics": []},
  {"id": "c076", "text": "The course is okay, neither very good nor very bad.", "sentiment": "neutral", "topics": []},
  {"id": "c077", "text": "Outstanding professor, highly respect his knowledge and dedication.", "sentiment": "positive", "topics": []},
  {"id": "c078", "text": "Very frustrating semester overall.", "sentiment": "negative", "topics": []},
  {"id": "c079", "text": "Average teaching quality, nothing special.", "sentiment": "neutral", "topics": []},
  {"id": "c080", "text": "Loved this subject so much, thank you sir!", "sentiment": "positive", "topics": []},

  # -------------------- INFORMAL / INDIAN ACADEMIC PHRASING --------------------
  {"id": "c081", "text": "Sir explains nicely but syllabus is very vast to revise before exams.", "sentiment": "neutral", "topics": ["teaching_clarity", "course_content"]},
  {"id": "c082", "text": "Madam is very polite and solves all doubts during lab hours.", "sentiment": "positive", "topics": ["doubt_handling"]},
  {"id": "c083", "text": "Speed is too high, portion completion is done in a hurry.", "sentiment": "negative", "topics": ["teaching_pace"]},
  {"id": "c084", "text": "Marks cutting in mid-sem was very strict and no explanation given.", "sentiment": "negative", "topics": ["assignments"]},
  {"id": "c085", "text": "Sir gives great tips and practical hacks for coding interviews.", "sentiment": "positive", "topics": ["practical_examples"]},
  {"id": "c086", "text": "Class is very boring, sir only reads PPT from start to end.", "sentiment": "negative", "topics": ["engagement", "teaching_clarity"]},
  {"id": "c087", "text": "Good explanation of theory but practical lab conduction was poor.", "sentiment": "neutral", "topics": ["teaching_clarity", "practical_examples"]},
  {"id": "c088", "text": "Doubt clearing is super helpful, sir stays back after class.", "sentiment": "positive", "topics": ["doubt_handling"]},
  {"id": "c089", "text": "PPT slides are directly downloaded from web, zero original effort.", "sentiment": "negative", "topics": ["course_content"]},
  {"id": "c090", "text": "Pacing is normal and covers all prescribed units properly.", "sentiment": "neutral", "topics": ["teaching_pace", "course_content"]},
  {"id": "c091", "text": "Very cooperative faculty, always ready to clarify our confusion.", "sentiment": "positive", "topics": ["doubt_handling"]},
  {"id": "c092", "text": "No live demonstration of coding, only PDF reading.", "sentiment": "negative", "topics": ["practical_examples"]},
  {"id": "c093", "text": "Interactive teaching style makes 8am class bearable and lively.", "sentiment": "positive", "topics": ["engagement"]},
  {"id": "c094", "text": "Surprise quizzes are unfair and syllabus was not completed yet.", "sentiment": "negative", "topics": ["assignments", "teaching_pace"]},
  {"id": "c095", "text": "Curriculum provides strong conceptual grounding for competitive programming.", "sentiment": "positive", "topics": ["course_content", "teaching_clarity"]},
  {"id": "c096", "text": "Explanations are decent, nothing much to complain or praise.", "sentiment": "neutral", "topics": ["teaching_clarity"]},
  {"id": "c097", "text": "Fast teaching speed makes it difficult for non-CS background students.", "sentiment": "negative", "topics": ["teaching_pace"]},
  {"id": "c098", "text": "Real-world database examples helped clear indexing concepts completely.", "sentiment": "positive", "topics": ["practical_examples", "teaching_clarity"]},
  {"id": "c099", "text": "Assignment questions are copy-pasted directly from online websites.", "sentiment": "negative", "topics": ["assignments"]},
  {"id": "c100", "text": "Best teacher for algorithms, doubts and concepts both handled masterfully.", "sentiment": "positive", "topics": ["teaching_clarity", "doubt_handling"]},
]

def generate_dataset_file():
    data_dir = Path(__file__).resolve().parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    out_file = data_dir / "feedback_dataset.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(DATASET, f, indent=2, ensure_ascii=False)
    print(f"Generated benchmark dataset with {len(DATASET)} records at {out_file}")

if __name__ == "__main__":
    generate_dataset_file()
