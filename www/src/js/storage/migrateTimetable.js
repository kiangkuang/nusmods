// @flow

import qs from 'query-string';
import { each } from 'lodash';

import type { SemTimetableConfig } from 'types/timetables';
import type { Semester } from 'types/modules';
import { LESSON_ABBREV_TYPE } from 'utils/timetables';

// TODO: Remove this file when sem 2 is over and v2 migration is done
//       also remember to remove localforage
export const MIGRATION_KEYS: [Semester, string][] = [
  [1, 'timetable/2017-2018/sem1:queryString'],
  [2, 'timetable/2017-2018/sem2:queryString'],
  [3, 'timetable/2017-2018/sem3:queryString'],
  [4, 'timetable/2017-2018/sem4:queryString'],
];

export function parseQueryString(queryString: string): SemTimetableConfig {
  const timetable = {};
  each(qs.parse(queryString), (classNo, key) => {
    const matches = key.match(/(\w{2,3}\d{4}\w{0,2})(?:\[([\w\s]+)])?/);
    if (!matches) return;

    const [, moduleCode, lessonTypeAbbrev] = matches;
    if (!timetable[moduleCode]) {
      timetable[moduleCode] = {};
    }

    if (lessonTypeAbbrev) {
      timetable[moduleCode][LESSON_ABBREV_TYPE[lessonTypeAbbrev]] = classNo;
    }
  });

  return timetable;
}
