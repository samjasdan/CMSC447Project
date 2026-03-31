from bs4 import BeautifulSoup
import csv
import re
import os
import random
import string
import sys

#need beautifulsoup package

INPUT_FILE = sys.argv[1] if len(sys.argv) > 1 else "drop_in_tutoring.html"

DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

SUBJECTS = {
    'BIOL': 'Biology',
    'CHEM': 'Chemistry',
    'CMPE': 'Computer Engineering',
    'CMSC': 'Computer Science',
    'ECON': 'Economics',
    'GES':  'Geographical and Environmental Systems',
    'IS':   'Information Systems',
    'MATH': 'Mathematics',
    'PHYS': 'Physics',
    'SCI':  'Science',
    'SPAN': 'Spanish',
    'STAT': 'Statistics',
}

LAST_NAMES = [
    'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
    'Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson',
    'Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson',
    'White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker',
    'Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
    'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell',
    'Carter','Roberts'
]


def load_soup(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    outer = BeautifulSoup(content, 'html.parser')
    line_cells = outer.select('td.line-content')
    if line_cells:
        inner_html = '\n'.join(td.get_text() for td in line_cells)
        return BeautifulSoup(inner_html, 'html.parser')
    return outer


def parse_time_line(line):
    line = line.strip()
    if not line or line.startswith('(located'):
        return None
    parts = re.split(r'\s*[–\-]\s*', line)
    if len(parts) >= 3:
        return parts[0].strip(), parts[1].strip(), parts[2].strip()
    elif len(parts) == 2:
        return parts[0].strip(), '', parts[1].strip()
    return None


def parse_via_paragraphs(content_div):
    results = []
    for p in content_div.find_all('p'):
        heading = p.find(['strong', 'b'])
        if not heading:
            continue
        heading_text = heading.get_text(strip=True).rstrip(':').strip()
        if heading_text not in DAYS:
            continue
        day = heading_text
        for br in p.find_all('br'):
            br.replace_with('\n')
        lines = p.get_text().split('\n')
        for line in lines[1:]:
            parsed = parse_time_line(line)
            if parsed:
                results.append((day,) + parsed)
    return results


def parse_via_raw_text(content_div):
    results = []
    for br in content_div.find_all('br'):
        br.replace_with('\n')
    text = content_div.get_text()
    current_day = None
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
        if line in DAYS:
            current_day = line
            continue
        if current_day:
            parsed = parse_time_line(line)
            if parsed:
                results.append((current_day,) + parsed)
    return results


def generate_umbc_id(used_ids):
    while True:
        uid = (
            random.choice(string.ascii_uppercase) +
            random.choice(string.ascii_uppercase) +
            str(random.randint(10000, 99999))
        )
        if uid not in used_ids:
            used_ids.add(uid)
            return uid


def generate_email(first, last, used_emails):
    base = re.sub(r'[^a-z]', '', (first[0] + last).lower())
    candidate = base + '@umbc.edu'
    counter = 1
    while candidate in used_emails:
        candidate = base + str(counter) + '@umbc.edu'
        counter += 1
    used_emails.add(candidate)
    return candidate


def main():
    if not os.path.exists(INPUT_FILE):
        print(f"ERROR: Could not find '{INPUT_FILE}'.")
        return

    print(f"Reading {INPUT_FILE}...")
    soup = load_soup(INPUT_FILE)

    raw_rows = []
    courses_seen = {}

    wrappers = soup.select('.sights-expander-wrapper')
    print(f"Found {len(wrappers)} course sections.")

    for wrapper in wrappers:
        trigger = wrapper.select_one('.sights-expander-trigger .mceEditable')
        if not trigger:
            continue
        course_raw = re.sub(r'\s+', ' ', trigger.get_text(strip=True))

        m = re.match(r'^([A-Z]+)\s+(\d+[A-Z]?)\s*[–\-]\s*(.+)$', course_raw)
        if not m:
            continue
        subject_code = m.group(1).strip()
        course_number = m.group(2).strip()
        course_name = m.group(3).strip()

        courses_seen[course_number] = (subject_code, course_name)

        content_div = wrapper.select_one('.sights-expander-content .mceEditable')
        if not content_div:
            continue

        schedule = parse_via_paragraphs(content_div)
        if not schedule:
            schedule = parse_via_raw_text(content_div)

        for day, start_time, end_time, tutor in schedule:
            raw_rows.append({
                'subject_code': subject_code,
                'course_code': course_number,
                'course_name': course_name,
                'day_of_week': day,
                'start_time': start_time,
                'end_time': end_time,
                'first_name': tutor,
            })

    tutor_names = sorted(set(r['first_name'] for r in raw_rows))
    used_ids = set()
    used_emails = set()
    random.seed(42)

    tutor_rows = []
    for first in tutor_names:
        last = random.choice(LAST_NAMES)
        tutor_rows.append({
            'first_name': first,
            'last_name': last,
            'umbc_id': generate_umbc_id(used_ids),
            'umbc_email': generate_email(first, last, used_emails),
        })

    with open('output.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)

        writer.writerow(['subjects'])
        writer.writerow(['subject_code', 'subject_name'])
        for code, name in SUBJECTS.items():
            writer.writerow([code, name])

        writer.writerow([])

        writer.writerow(['courses'])
        writer.writerow(['subject_code', 'course_code', 'course_name'])
        seen = set()
        for row in raw_rows:
            key = (row['subject_code'], row['course_code'])
            if key not in seen:
                seen.add(key)
                writer.writerow([row['subject_code'], row['course_code'], row['course_name']])

        writer.writerow([])

        writer.writerow(['wp_users'])
        writer.writerow(['first_name', 'last_name', 'umbc_id', 'umbc_email'])
        for row in tutor_rows:
            writer.writerow([row['first_name'], row['last_name'], row['umbc_id'], row['umbc_email']])

        writer.writerow([])

        writer.writerow(['schedule'])
        writer.writerow(['first_name', 'subject_code', 'course_code', 'day_of_week', 'start_time', 'end_time'])
        for row in raw_rows:
            writer.writerow([row['first_name'], row['subject_code'], row['course_code'], row['day_of_week'], row['start_time'], row['end_time']])

    print("Written: output.csv")
    print(f"\nDone! {len(raw_rows)} schedule rows, {len(tutor_names)} tutors, {len(seen)} courses.")


if __name__ == '__main__':
    main()