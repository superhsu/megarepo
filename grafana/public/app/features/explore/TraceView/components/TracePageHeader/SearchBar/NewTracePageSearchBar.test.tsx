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

import { render, screen } from '@testing-library/react';
import React from 'react';

import { defaultFilters } from '../../../useSearch';

import NewTracePageSearchBar from './NewTracePageSearchBar';

describe('<NewTracePageSearchBar>', () => {
  const NewTracePageSearchBarWithProps = (props: { matches: string[] | undefined }) => {
    const searchBarProps = {
      search: defaultFilters,
      spanFilterMatches: props.matches ? new Set(props.matches) : undefined,
      showSpanFilterMatchesOnly: false,
      setShowSpanFilterMatchesOnly: jest.fn(),
      setFocusedSpanIdForSearch: jest.fn(),
      focusedSpanIndexForSearch: -1,
      setFocusedSpanIndexForSearch: jest.fn(),
      datasourceType: '',
      clear: jest.fn(),
      totalSpans: 100,
      showSpanFilters: true,
    };

    return <NewTracePageSearchBar {...searchBarProps} />;
  };

  it('should render', () => {
    expect(() => render(<NewTracePageSearchBarWithProps matches={[]} />)).not.toThrow();
  });

  it('renders clear filter button', () => {
    render(<NewTracePageSearchBarWithProps matches={[]} />);
    const clearFiltersButton = screen.getByRole('button', { name: 'Clear filters button' });
    expect(clearFiltersButton).toBeInTheDocument();
    expect((clearFiltersButton as HTMLButtonElement)['disabled']).toBe(true);
  });

  it('renders show span filter matches only switch', async () => {
    render(<NewTracePageSearchBarWithProps matches={[]} />);
    const matchesSwitch = screen.getByRole('checkbox', { name: 'Show matches only switch' });
    expect(matchesSwitch).toBeInTheDocument();
  });
});
