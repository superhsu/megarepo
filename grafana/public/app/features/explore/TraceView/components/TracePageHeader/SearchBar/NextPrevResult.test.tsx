// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

import { createTheme } from '@grafana/data';

import { defaultFilters } from '../../../useSearch';

import NextPrevResult, { getStyles } from './NextPrevResult';

describe('<NextPrevResult>', () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const NextPrevResultWithProps = (props: { matches: string[] | undefined }) => {
    const [focusedSpanIndexForSearch, setFocusedSpanIndexForSearch] = useState(-1);
    const searchBarProps = {
      search: defaultFilters,
      spanFilterMatches: props.matches ? new Set(props.matches) : undefined,
      showSpanFilterMatchesOnly: false,
      setShowSpanFilterMatchesOnly: jest.fn(),
      setFocusedSpanIdForSearch: jest.fn(),
      focusedSpanIndexForSearch: focusedSpanIndexForSearch,
      setFocusedSpanIndexForSearch: setFocusedSpanIndexForSearch,
      datasourceType: '',
      clear: jest.fn(),
      totalSpans: 100,
      showSpanFilters: true,
    };

    return <NextPrevResult {...searchBarProps} />;
  };

  it('should render', () => {
    expect(() => render(<NextPrevResultWithProps matches={[]} />)).not.toThrow();
  });

  it('renders UI properly', () => {
    render(<NextPrevResultWithProps matches={[]} />);
    const nextResButton = screen.queryByRole('button', { name: 'Next result button' });
    const prevResButton = screen.queryByRole('button', { name: 'Prev result button' });
    expect(nextResButton).toBeInTheDocument();
    expect(prevResButton).toBeInTheDocument();
    expect(nextResButton as HTMLDivElement).toHaveStyle('pointer-events: none');
    expect(prevResButton as HTMLDivElement).toHaveStyle('pointer-events: none');
    expect(screen.getByText('0 matches')).toBeDefined();
  });

  it('renders total spans', async () => {
    render(<NextPrevResultWithProps matches={undefined} />);
    expect(screen.getByText('100 spans')).toBeDefined();
  });

  it('renders buttons that can be used to search if filters added', () => {
    render(<NextPrevResultWithProps matches={['2ed38015486087ca']} />);
    const nextResButton = screen.queryByRole('button', { name: 'Next result button' });
    const prevResButton = screen.queryByRole('button', { name: 'Prev result button' });
    expect(nextResButton).toBeInTheDocument();
    expect(prevResButton).toBeInTheDocument();
    expect(nextResButton as HTMLDivElement).not.toHaveStyle('pointer-events: none');
    expect(prevResButton as HTMLDivElement).not.toHaveStyle('pointer-events: none');
    expect(screen.getByText('1 match')).toBeDefined();
  });

  it('renders correctly when moving through matches', async () => {
    render(<NextPrevResultWithProps matches={['1ed38015486087ca', '2ed38015486087ca', '3ed38015486087ca']} />);
    const nextResButton = screen.queryByRole('button', { name: 'Next result button' });
    const prevResButton = screen.queryByRole('button', { name: 'Prev result button' });
    expect(screen.getByText('3 matches')).toBeDefined();
    await user.click(nextResButton!);
    expect(screen.getByText('1/3 matches')).toBeDefined();
    await user.click(nextResButton!);
    expect(screen.getByText('2/3 matches')).toBeDefined();
    await user.click(nextResButton!);
    expect(screen.getByText('3/3 matches')).toBeDefined();
    await user.click(nextResButton!);
    expect(screen.getByText('1/3 matches')).toBeDefined();
    await user.click(prevResButton!);
    expect(screen.getByText('3/3 matches')).toBeDefined();
    await user.click(prevResButton!);
    expect(screen.getByText('2/3 matches')).toBeDefined();
  });

  it('renders correctly when there are no matches i.e. too many filters added', async () => {
    const { container } = render(<NextPrevResultWithProps matches={[]} />);
    const theme = createTheme();
    const tooltip = container.querySelector('.' + getStyles(theme, true).matchesTooltip);
    expect(screen.getByText('0 matches')).toBeDefined();
    userEvent.hover(tooltip!);
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText(/0 span matches for the filters selected/)).toBeDefined();
    });
  });
});
