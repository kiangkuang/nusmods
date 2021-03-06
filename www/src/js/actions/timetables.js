// @flow
import { flatMap, isEmpty, each } from 'lodash';
import localforage from 'localforage';

import type { ModuleLessonConfig, SemTimetableConfig } from 'types/timetables';
import type { FSA } from 'types/redux';
import type { ColorMapping, ColorIndex } from 'types/reducers';
import type { Module, ModuleCode, Semester, Lesson, ClassNo, LessonType } from 'types/modules';

import { fetchModule } from 'actions/moduleBank';
import { randomModuleLessonConfig, validateTimetableModules } from 'utils/timetables';
import { getModuleTimetable } from 'utils/modules';
import storage from 'storage';
import { MIGRATION_KEYS, parseQueryString } from 'storage/migrateTimetable';

const V2_MIGRATION_KEY = 'v2Migration';

export const ADD_MODULE: string = 'ADD_MODULE';
export function addModule(
  semester: Semester,
  moduleCode: ModuleCode,
  lessonConfig: ModuleLessonConfig = {},
  colorIndex?: ColorIndex,
) {
  return (dispatch: Function, getState: Function) =>
    dispatch(fetchModule(moduleCode)).then(() => {
      const module: Module = getState().moduleBank.modules[moduleCode];
      const lessons = getModuleTimetable(module, semester);
      const moduleLessonConfig =
        lessons && isEmpty(lessonConfig) ? randomModuleLessonConfig(lessons) : lessonConfig;

      return dispatch({
        type: ADD_MODULE,
        payload: {
          semester,
          moduleCode,
          moduleLessonConfig,
          colorIndex,
        },
      });
    });
}

export const REMOVE_MODULE: string = 'REMOVE_MODULE';
export function removeModule(semester: Semester, moduleCode: ModuleCode): FSA {
  return {
    type: REMOVE_MODULE,
    payload: {
      semester,
      moduleCode,
    },
  };
}

export const MODIFY_LESSON: string = 'MODIFY_LESSON';
export function modifyLesson(activeLesson: Lesson): FSA {
  return {
    type: MODIFY_LESSON,
    payload: {
      activeLesson,
    },
  };
}

export const CHANGE_LESSON: string = 'CHANGE_LESSON';
export function setLesson(
  semester: Semester,
  moduleCode: ModuleCode,
  lessonType: LessonType,
  classNo: ClassNo,
): FSA {
  return {
    type: CHANGE_LESSON,
    payload: {
      semester,
      moduleCode,
      lessonType,
      classNo,
    },
  };
}

export function changeLesson(semester: Semester, lesson: Lesson): FSA {
  return setLesson(semester, lesson.ModuleCode, lesson.LessonType, lesson.ClassNo);
}

export const CANCEL_MODIFY_LESSON: string = 'CANCEL_MODIFY_LESSON';
export function cancelModifyLesson(): FSA {
  return {
    type: CANCEL_MODIFY_LESSON,
    payload: null,
  };
}

export const SET_TIMETABLE = 'SET_TIMETABLE';
export function setTimetable(
  semester: Semester,
  timetable?: SemTimetableConfig,
  colors?: ColorMapping,
) {
  return (dispatch: Function, getState: Function) => {
    let validatedTimetable = timetable;
    if (timetable) {
      const moduleCodes = getState().moduleBank.moduleCodes;
      [validatedTimetable] = validateTimetableModules(timetable, moduleCodes);
    }

    return dispatch({
      type: SET_TIMETABLE,
      payload: { semester, timetable: validatedTimetable, colors },
    });
  };
}

export function fillTimetableBlanks(semester: Semester) {
  return (dispatch: Function, getState: Function) => {
    const { timetables, moduleBank } = getState();

    // Extract the timetable and the modules for the semester
    const timetable = timetables[semester];
    if (!timetable) return;

    // Check that all lessons for each module is filled, if they are not, use the
    // randomly generated config to fill them in
    each(timetable, (lessonConfig: ModuleLessonConfig, moduleCode: ModuleCode) => {
      const module = moduleBank.modules[moduleCode];
      if (!module) return;

      const lessons = getModuleTimetable(module, semester);
      const randomLessonConfig = randomModuleLessonConfig(lessons);

      each(randomLessonConfig, (classNo: ClassNo, lessonType: LessonType) => {
        if (!lessonConfig[lessonType]) {
          dispatch(setLesson(semester, moduleCode, lessonType, classNo));
        }
      });
    });
  };
}

export function fetchTimetableModules(timetables: SemTimetableConfig[]) {
  return (dispatch: Function) => {
    const moduleCodes = new Set(flatMap(timetables, Object.keys));
    return Promise.all(
      Array.from(moduleCodes).map((moduleCode) => dispatch(fetchModule(moduleCode))),
    );
  };
}

export function migrateTimetable() {
  return (dispatch: Function, getState: Function): Promise<*> => {
    if (storage.getItem(V2_MIGRATION_KEY)) {
      return Promise.resolve();
    }

    const promises = MIGRATION_KEYS.map(([semester, key]) =>
      localforage.getItem(key).then((queryString) => {
        // Do nothing if there's no data
        if (!queryString) return null;

        const timetable = parseQueryString(queryString);
        const [validTimetable] = validateTimetableModules(
          timetable,
          getState().moduleBank.moduleCodes,
        );

        dispatch(setTimetable(semester, validTimetable));
        return dispatch(fetchTimetableModules([timetable])).then(() =>
          dispatch(fillTimetableBlanks(semester)),
        );
      }),
    );

    return Promise.all(promises).then(() => storage.setItem(V2_MIGRATION_KEY, true));
  };
}
