/*global Gun*/
/*eslint no-undef: "off"*/

import { ADD_TODO, INSERT_TODO, UPDATE_TODO, DELETE_TODO, EDIT_TODO, COMPLETE_TODO, COMPLETE_ALL, CLEAR_COMPLETED } from '../constants/ActionTypes'

const initialState = [
  // {
  //   text: 'Use Redux',
  //   completed: false,
  //   id: 0
  // }
]


let rands = [Gun.text.random(),Gun.text.random(),Gun.text.random()]

function arr() {
  return [
    { title: 'one1', '[': rands[0] },
    { title: 'two2', '[': rands[1] },
    { title: 'three3', '[': rands[2] }
    ];
}

export default function todos(state = initialState, action) {
  switch (action.type) {
    case ADD_TODO:
      return [
        {
          id: Gun.text.random(), //state.reduce((maxId, todo) => Math.max(todo.id, maxId), -1) + 1,
          completed: false,
          text: action.text
        },
        ...state
      ]

    case INSERT_TODO:
      return [
        action.todo,
        ...state
      ]

    case UPDATE_TODO:
      return state.map(todo =>
        todo.id === action.id ?
        // { ...todo, text: action.todo.text, complete: action.todo.completed
        //   , testRel: action.todo.testRel || null, testArr: action.todo.testArr || null
        // }
          action.todo
        :
          todo
      )

    case DELETE_TODO:
      return state.filter(todo =>
        todo.id !== action.id
      )

    case EDIT_TODO:
      return state.map(todo =>
        todo.id === action.id ?
          { ...todo, text: action.text } :
          todo
      )

    case COMPLETE_TODO:
      return state.map(todo =>
        todo.id === action.id ?
          { ...todo, completed: !todo.completed, testRel: {
            alfa: 'hash',
            beta: { gamma: 'inside' }
          },
            testArr: todo.testArr || arr()
          } :
          todo
      )

    case COMPLETE_ALL:
      const areAllMarked = state.every(todo => todo.completed)
      return state.map(todo => ({
        ...todo,
        completed: !areAllMarked
      }))

    case CLEAR_COMPLETED:
      return state.filter(todo => todo.completed === false)

    default:
      return state
  }
}
